import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Contact, ContactRole } from '../common/types';
import { EmergencyRepository } from '../common/repository';

export interface UpsertContactDto {
  elderId: string;
  name: string;
  role: ContactRole;
  phone: string;
  relation?: string;
  priority: number;
  enabled?: boolean;
  note?: string;
}

@Injectable()
export class ContactsService {
  constructor(private readonly repo: EmergencyRepository) {}

  async list(elderId?: string): Promise<Contact[]> {
    const list = await this.repo.listContacts(elderId);
    // 永不在列表接口暴露家属令牌
    return list.map((c) => ({ ...c, accessToken: undefined }));
  }

  async get(id: string): Promise<Contact> {
    const contact = await this.repo.getContact(id);
    if (!contact) throw new NotFoundException('联系人不存在');
    return { ...contact, accessToken: undefined };
  }

  async create(dto: UpsertContactDto): Promise<Contact> {
    await this.ensureElder(dto.elderId);
    this.validate(dto);
    const accessToken =
      dto.role === 'family' ? this.generateToken() : undefined;
    const contact = await this.repo.createContact({
      elderId: dto.elderId,
      name: dto.name,
      role: dto.role,
      phone: dto.phone,
      relation: dto.relation,
      priority: dto.priority,
      enabled: dto.enabled ?? true,
      note: dto.note,
      accessToken,
    });
    return contact;
  }

  async update(id: string, patch: Partial<UpsertContactDto>): Promise<Contact> {
    const existing = await this.repo.getContact(id);
    if (!existing) throw new NotFoundException('联系人不存在');
    const merged = {
      elderId: patch.elderId ?? existing.elderId,
      name: patch.name ?? existing.name,
      role: patch.role ?? existing.role,
      phone: patch.phone ?? existing.phone,
      relation: patch.relation ?? existing.relation,
      priority: patch.priority ?? existing.priority,
      note: patch.note ?? existing.note,
    };
    this.validate(merged);
    const updated = await this.repo.updateContact(id, {
      ...patch,
      enabled: patch.enabled,
    });
    return { ...updated, accessToken: undefined };
  }

  /** 一次性重排某位老人的全部联系人优先级（拖拽排序后保存） */
  async reorder(elderId: string, orderedIds: string[]): Promise<Contact[]> {
    await this.ensureElder(elderId);
    const contacts = await this.repo.listContacts(elderId);
    const idSet = new Set(contacts.map((c) => c.id));
    if (orderedIds.some((id) => !idSet.has(id))) {
      throw new BadRequestException('排序列表中存在不属于该老人的联系人');
    }
    if (orderedIds.length !== contacts.length) {
      throw new BadRequestException('必须包含该老人的全部联系人');
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await this.repo.updateContact(orderedIds[i], { priority: i + 1 });
    }
    return this.list(elderId);
  }

  /** 重新签发家属 H5 访问令牌（原令牌失效） */
  async rotateToken(id: string): Promise<{ id: string; accessToken: string }> {
    const existing = await this.repo.getContact(id);
    if (!existing) throw new NotFoundException('联系人不存在');
    if (existing.role !== 'family') {
      throw new BadRequestException('仅家属联系人可签发访问令牌');
    }
    const accessToken = this.generateToken();
    await this.repo.updateContact(id, { accessToken });
    return { id, accessToken };
  }

  async remove(id: string): Promise<{ success: true }> {
    await this.repo.deleteContact(id);
    return { success: true };
  }

  private async ensureElder(elderId: string): Promise<void> {
    const elder = await this.repo.getElder(elderId);
    if (!elder) throw new BadRequestException('老人信息不存在');
  }

  private validate(
    dto: Pick<UpsertContactDto, 'name' | 'role' | 'phone' | 'priority'>,
  ): void {
    if (!dto.name?.trim()) throw new BadRequestException('联系人姓名不能为空');
    if (!dto.phone?.trim()) throw new BadRequestException('联系电话不能为空');
    if (!Number.isInteger(dto.priority) || dto.priority < 1) {
      throw new BadRequestException('优先级必须是不小于 1 的整数');
    }
    const allowedRoles: ContactRole[] = [
      'family',
      'neighbor',
      'doctor',
      'property',
    ];
    if (!allowedRoles.includes(dto.role)) {
      throw new BadRequestException(
        '联系人身份只能是 family/neighbor/doctor/property',
      );
    }
  }

  private generateToken(): string {
    const s = () => Math.random().toString(36).slice(2, 10);
    return `fam_${s()}${s()}`;
  }
}
