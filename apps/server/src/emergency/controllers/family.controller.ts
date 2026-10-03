import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Query,
} from '@nestjs/common';
import { EmergencyRepository } from '../repository/emergency.repository';
import { ReportService } from '../services/report.service';
import { EmergencyService } from '../services/emergency.service';
import {
  CONTACT_TYPE_LABEL,
  EVENT_TYPE_LABEL,
  EVENT_STATUS_LABEL,
} from '../emergency.types';

/**
 * 家属 H5 接口，统一挂在 /api/family 下。
 * 家属凭「专属访问令牌」（建家属联系人时生成）访问；
 * 所有返回内容都按联系人维度过滤，只能看到与自己相关的信息。
 */
@Controller('family')
export class FamilyController {
  constructor(
    private readonly repo: EmergencyRepository,
    private readonly reportService: ReportService,
    private readonly emergencyService: EmergencyService,
  ) {}

  @Get('me')
  me(
    @Headers('x-family-token') headerToken?: string,
    @Query('token') queryToken?: string,
  ) {
    const contact = this.authenticate(headerToken ?? queryToken);
    const elder = this.repo.getElder(contact.elderId);
    return {
      name: contact.name,
      relation: contact.relation,
      type: CONTACT_TYPE_LABEL[contact.type],
      elderName: elder?.name ?? '',
      elderAddress: elder?.address ?? '',
    };
  }

  /** 与该家属相关的事件列表（仅自己作为联系人的老人） */
  @Get('events')
  listEvents(
    @Headers('x-family-token') headerToken?: string,
    @Query('token') queryToken?: string,
  ) {
    const contact = this.authenticate(headerToken ?? queryToken);
    return this.emergencyService.listEvents(contact.elderId).map((e) => ({
      id: e.id,
      type: EVENT_TYPE_LABEL[e.type],
      rawType: e.type,
      description: e.description,
      status: EVENT_STATUS_LABEL[e.status],
      rawStatus: e.status,
      triggeredAt: e.triggeredAt,
      closedAt: e.closedAt,
      // 家属在本次事件中是否被呼叫 / 是否本人接通，用于列表角标
      myCall: this.myCallBrief(e.id, contact.id),
    }));
  }

  /** 事件处置报告（仅本人相关片段） */
  @Get('events/:eventId/report')
  eventReport(
    @Param('eventId') eventId: string,
    @Headers('x-family-token') headerToken?: string,
    @Query('token') queryToken?: string,
  ) {
    const contact = this.authenticate(headerToken ?? queryToken);
    // 越权校验：事件必须属于该家属对应的老人
    const event = this.emergencyService.getEventOrThrow(eventId);
    if (event.elderId !== contact.elderId) {
      // 不暴露事件是否存在，统一按 404 处理
      throw new BadRequestException('无权查看该事件');
    }
    return this.reportService.buildFamilyReport(eventId, contact.id);
  }

  private authenticate(token: string | undefined | null) {
    if (!token) throw new BadRequestException('缺少家属访问令牌');
    const contact = this.repo.getContactByToken(token);
    if (!contact || contact.type !== 'family' || !contact.enabled) {
      throw new BadRequestException('访问令牌无效或已停用');
    }
    return contact;
  }

  private myCallBrief(eventId: string, contactId: string) {
    const attempts = this.repo
      .listAttempts(eventId)
      .filter((a) => a.contactId === contactId);
    if (attempts.length === 0) return null;
    const last = attempts[attempts.length - 1];
    return {
      sequence: last.sequence,
      outcome: last.outcome,
      outcomeLabel:
        {
          pending: '振铃中',
          answered: '您已接通',
          no_answer: '未接听',
          rejected: '已挂断',
          offline: '无法接通',
        }[last.outcome] ?? last.outcome,
    };
  }
}
