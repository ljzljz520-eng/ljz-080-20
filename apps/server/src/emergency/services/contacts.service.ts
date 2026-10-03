import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ContactType, Elder, EmergencyContact } from '../emergency.types';
import { EmergencyRepository, genId } from '../repository/emergency.repository';
import { CreateElderDto, UpsertContactDto } from '../dto/emergency.dto';

const PHONE_RE = /^1[3-9]\d{9}$/;

/**
 * 老人档案 + 紧急联系人（家属 / 邻里 / 社区医生 / 物业）管理。
 */
@Injectable()
export class ContactsService implements OnModuleInit {
  constructor(private readonly repo: EmergencyRepository) {}

  onModuleInit(): void {
    this.seedIfEmpty();
  }

  // ---------- 老人 ----------

  listElders(): (Elder & { contactCount: number })[] {
    return this.repo.listElders().map((e) => ({
      ...e,
      contactCount: this.repo.listContacts(e.id).length,
    }));
  }

  getElderOrThrow(id: string): Elder {
    const elder = this.repo.getElder(id);
    if (!elder) throw new NotFoundException(`老人不存在：${id}`);
    return elder;
  }

  createElder(dto: CreateElderDto): Elder {
    if (!dto.name?.trim()) throw new BadRequestException('请填写老人姓名');
    if (!Number.isFinite(dto.age) || dto.age <= 0)
      throw new BadRequestException('年龄不合法');
    if (!PHONE_RE.test(dto.phone))
      throw new BadRequestException('请填写正确的 11 位手机号');
    const elder: Elder = {
      id: genId('elder'),
      name: dto.name.trim(),
      gender: dto.gender,
      age: dto.age,
      room: dto.room?.trim() || '待分配',
      address: dto.address?.trim() || '',
      phone: dto.phone,
      createdAt: new Date().toISOString(),
    };
    return this.repo.saveElder(elder);
  }

  // ---------- 联系人 ----------

  listContacts(elderId: string): EmergencyContact[] {
    this.getElderOrThrow(elderId);
    // 管理端不回传家属令牌，避免后台越权拿到家属 H5 访问凭证
    return this.repo.listContacts(elderId).map((c) => ({
      id: c.id,
      elderId: c.elderId,
      name: c.name,
      relation: c.relation,
      type: c.type,
      phone: c.phone,
      priority: c.priority,
      enabled: c.enabled,
      // 管理端不回传家属令牌，避免后台越权拿到家属 H5 访问凭证
      familyToken: null as string | null,
      createdAt: c.createdAt,
    }));
  }

  addContact(elderId: string, dto: UpsertContactDto): EmergencyContact {
    this.getElderOrThrow(elderId);
    this.validateContact(dto);

    const priority = Math.trunc(dto.priority);
    if (this.repo.priorityTaken(elderId, priority)) {
      // 自动顺延：占用的优先级及之后的联系人整体后移一位
      this.shiftPriorities(elderId, priority);
    }
    const contact: EmergencyContact = {
      id: genId('contact'),
      elderId,
      name: dto.name.trim(),
      relation: dto.relation?.trim() || '',
      type: dto.type,
      phone: dto.phone,
      priority,
      enabled: dto.enabled ?? true,
      familyToken: dto.type === 'family' ? genId('ft').replace('_', '-') : null,
      createdAt: new Date().toISOString(),
    };
    return this.repo.saveContact(contact);
  }

  updateContact(
    elderId: string,
    contactId: string,
    dto: UpsertContactDto,
  ): EmergencyContact {
    const contact = this.repo.getContact(contactId);
    if (!contact || contact.elderId !== elderId)
      throw new NotFoundException('联系人不存在');
    this.validateContact(dto);

    const priority = Math.trunc(dto.priority);
    if (
      priority !== contact.priority &&
      this.repo.priorityTaken(elderId, priority, contactId)
    ) {
      throw new BadRequestException(`优先级 ${priority} 已被其他联系人占用`);
    }
    const updated: EmergencyContact = {
      ...contact,
      name: dto.name.trim(),
      relation: dto.relation?.trim() || '',
      type: dto.type,
      phone: dto.phone,
      priority,
      enabled: dto.enabled ?? contact.enabled,
      // 类别切换为家属时补发令牌；移出家属类别时回收令牌
      familyToken:
        dto.type === 'family'
          ? (contact.familyToken ?? genId('ft').replace('_', '-'))
          : null,
    };
    return this.repo.saveContact(updated);
  }

  toggleContact(
    elderId: string,
    contactId: string,
    enabled: boolean,
  ): EmergencyContact {
    const contact = this.repo.getContact(contactId);
    if (!contact || contact.elderId !== elderId)
      throw new NotFoundException('联系人不存在');
    return this.repo.saveContact({ ...contact, enabled });
  }

  deleteContact(elderId: string, contactId: string): { ok: true } {
    const contact = this.repo.getContact(contactId);
    if (!contact || contact.elderId !== elderId)
      throw new NotFoundException('联系人不存在');
    this.repo.deleteContact(contactId);
    this.compactPriorities(elderId);
    return { ok: true };
  }

  /** 按 orderedContactIds 顺序重排优先级（1 开始） */
  reorder(elderId: string, orderedContactIds: string[]): EmergencyContact[] {
    const all = this.repo.listContacts(elderId);
    const byId = new Map(all.map((c) => [c.id, c]));
    const seen = new Set<string>();
    orderedContactIds.forEach((id, index) => {
      const c = byId.get(id);
      if (!c || c.elderId !== elderId)
        throw new BadRequestException(`联系人不属于该老人：${id}`);
      if (seen.has(id)) throw new BadRequestException('联系人顺序重复');
      seen.add(id);
      this.repo.saveContact({ ...c, priority: index + 1 });
    });
    // 未出现在列表里的联系人排到后面
    let p = orderedContactIds.length;
    all
      .filter((c) => !seen.has(c.id))
      .forEach((c) => {
        p += 1;
        this.repo.saveContact({ ...c, priority: p });
      });
    return this.listContacts(elderId);
  }

  /** 家属绑定信息（管理端「家属入口链接」展示用） */
  listFamilyBindings(elderId: string): {
    contactId: string;
    name: string;
    relation: string;
    token: string;
  }[] {
    return this.repo
      .listContactsByType(elderId, 'family')
      .filter((c) => c.familyToken)
      .map((c) => ({
        contactId: c.id,
        name: c.name,
        relation: c.relation,
        token: c.familyToken as string,
      }));
  }

  // ---------- 内部工具 ----------

  private validateContact(dto: UpsertContactDto): void {
    const types: ContactType[] = ['family', 'neighbor', 'doctor', 'property'];
    if (!types.includes(dto.type))
      throw new BadRequestException('联系人类别不合法');
    if (!dto.name?.trim()) throw new BadRequestException('请填写联系人姓名');
    if (!PHONE_RE.test(dto.phone))
      throw new BadRequestException('请填写正确的 11 位手机号');
    if (!Number.isInteger(dto.priority) || dto.priority < 1)
      throw new BadRequestException('优先级必须是不小于 1 的整数');
  }

  /** priority 及之后的联系人优先级 +1，给新联系人让位 */
  private shiftPriorities(elderId: string, fromPriority: number): void {
    this.repo
      .listContacts(elderId)
      .filter((c) => c.priority >= fromPriority)
      .sort((a, b) => b.priority - a.priority)
      .forEach((c) =>
        this.repo.saveContact({ ...c, priority: c.priority + 1 }),
      );
  }

  /** 删除后把优先级压实为 1..n */
  private compactPriorities(elderId: string): void {
    this.repo
      .listContacts(elderId)
      .forEach((c, i) => this.repo.saveContact({ ...c, priority: i + 1 }));
  }

  // ---------- 演示种子数据 ----------

  private seedIfEmpty(): void {
    if (this.repo.listElders().length > 0) return;

    const wang = this.repo.saveElder({
      id: 'elder-wang',
      name: '王秀兰',
      gender: 'female',
      age: 78,
      room: '3-2-501',
      address: '幸福里社区 3 栋 2 单元 501',
      phone: '13900000001',
      createdAt: new Date('2026-09-01T08:00:00Z').toISOString(),
    });

    this.repo.saveContact({
      id: 'contact-wang-son',
      elderId: wang.id,
      name: '李建国',
      relation: '长子',
      type: 'family',
      phone: '13800001111',
      priority: 1,
      enabled: true,
      familyToken: 'ft-wang-son-demo',
      createdAt: new Date('2026-09-01T08:10:00Z').toISOString(),
    });
    this.repo.saveContact({
      id: 'contact-wang-daughter',
      elderId: wang.id,
      name: '李建梅',
      relation: '女儿',
      type: 'family',
      phone: '13800002222',
      priority: 2,
      enabled: true,
      familyToken: 'ft-wang-daughter-demo',
      createdAt: new Date('2026-09-01T08:11:00Z').toISOString(),
    });
    this.repo.saveContact({
      id: 'contact-wang-doctor',
      elderId: wang.id,
      name: '陈医生',
      relation: '社区卫生服务中心',
      type: 'doctor',
      phone: '13600003333',
      priority: 3,
      enabled: true,
      familyToken: null,
      createdAt: new Date('2026-09-01T08:12:00Z').toISOString(),
    });
    this.repo.saveContact({
      id: 'contact-wang-neighbor',
      elderId: wang.id,
      name: '张阿姨',
      relation: '对门邻居',
      type: 'neighbor',
      phone: '13500004444',
      priority: 4,
      enabled: true,
      familyToken: null,
      createdAt: new Date('2026-09-01T08:13:00Z').toISOString(),
    });
    this.repo.saveContact({
      id: 'contact-wang-property',
      elderId: wang.id,
      name: '幸福里物业值班室',
      relation: '物业前台',
      type: 'property',
      phone: '13400005555',
      priority: 5,
      enabled: true,
      familyToken: null,
      createdAt: new Date('2026-09-01T08:14:00Z').toISOString(),
    });

    this.repo.saveElder({
      id: 'elder-zhao',
      name: '赵德海',
      gender: 'male',
      age: 82,
      room: '7-1-302',
      address: '幸福里社区 7 栋 1 单元 302',
      phone: '13900000002',
      createdAt: new Date('2026-09-02T08:00:00Z').toISOString(),
    });
    this.repo.saveContact({
      id: 'contact-zhao-son',
      elderId: 'elder-zhao',
      name: '赵军',
      relation: '儿子',
      type: 'family',
      phone: '13700006666',
      priority: 1,
      enabled: true,
      familyToken: 'ft-zhao-son-demo',
      createdAt: new Date('2026-09-02T08:10:00Z').toISOString(),
    });
    this.repo.saveContact({
      id: 'contact-zhao-property',
      elderId: 'elder-zhao',
      name: '幸福里物业值班室',
      relation: '物业前台',
      type: 'property',
      phone: '13400005555',
      priority: 2,
      enabled: true,
      familyToken: null,
      createdAt: new Date('2026-09-02T08:11:00Z').toISOString(),
    });
  }
}
