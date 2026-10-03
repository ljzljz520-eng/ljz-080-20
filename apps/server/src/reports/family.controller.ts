import { Controller, Get, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { FamilyAuthGuard } from '../common/auth.guards';
import { CurrentFamilyContact } from '../common/current-contact.decorator';
import type { Contact } from '../common/types';

@Controller('api/family')
@UseGuards(FamilyAuthGuard)
export class FamilyController {
  constructor(private readonly reportsService: ReportsService) {}

  /** 当前家属身份信息（不含令牌回显） */
  @Get('me')
  me(@CurrentFamilyContact() contact: Contact) {
    return {
      name: contact.name,
      role: contact.role,
      relation: contact.relation,
    };
  }

  /**
   * 家属处置报告列表：仅返回与该家属本人相关的内容，
   * 其他联系人仅做数量统计，不泄露姓名、电话与具体身份。
   */
  @Get('reports')
  reports(@CurrentFamilyContact() contact: Contact) {
    return this.reportsService.getFamilyView(contact);
  }
}
