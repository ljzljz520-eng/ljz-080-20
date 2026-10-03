import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ContactsService } from '../services/contacts.service';
import { EmergencyService } from '../services/emergency.service';
import { ReportService } from '../services/report.service';
import type {
  CreateElderDto,
  ReorderContactsDto,
  ResolveEventDto,
  SettleCallDto,
  TriggerEventDto,
  UpsertContactDto,
} from '../dto/emergency.dto';

/**
 * 工作人员（管家 / 社区后台）接口，统一挂在 /api/staff 下。
 */
@Controller('staff')
export class StaffController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly emergencyService: EmergencyService,
    private readonly reportService: ReportService,
  ) {}

  // ----- 老人档案 -----

  @Get('elders')
  listElders() {
    return this.contactsService.listElders();
  }

  @Post('elders')
  createElder(@Body() dto: CreateElderDto) {
    return this.contactsService.createElder(dto);
  }

  @Get('elders/:elderId')
  getElder(@Param('elderId') elderId: string) {
    return this.contactsService.getElderOrThrow(elderId);
  }

  // ----- 紧急联系人分级 -----

  @Get('elders/:elderId/contacts')
  listContacts(@Param('elderId') elderId: string) {
    return this.contactsService.listContacts(elderId);
  }

  @Post('elders/:elderId/contacts')
  addContact(@Param('elderId') elderId: string, @Body() dto: UpsertContactDto) {
    return this.contactsService.addContact(elderId, dto);
  }

  @Put('elders/:elderId/contacts/:contactId')
  updateContact(
    @Param('elderId') elderId: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpsertContactDto,
  ) {
    return this.contactsService.updateContact(elderId, contactId, dto);
  }

  @Patch('elders/:elderId/contacts/:contactId/toggle')
  toggleContact(
    @Param('elderId') elderId: string,
    @Param('contactId') contactId: string,
    @Body('enabled') enabled: boolean,
  ) {
    return this.contactsService.toggleContact(elderId, contactId, !!enabled);
  }

  @Delete('elders/:elderId/contacts/:contactId')
  deleteContact(
    @Param('elderId') elderId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.contactsService.deleteContact(elderId, contactId);
  }

  @Post('elders/:elderId/contacts/reorder')
  reorder(@Param('elderId') elderId: string, @Body() dto: ReorderContactsDto) {
    return this.contactsService.reorder(elderId, dto.orderedContactIds ?? []);
  }

  /** 获取家属 H5 访问链接所需令牌 */
  @Get('elders/:elderId/family-bindings')
  familyBindings(@Param('elderId') elderId: string) {
    return this.contactsService.listFamilyBindings(elderId);
  }

  // ----- 突发事件与分级呼叫 -----

  @Get('events')
  listEvents(@Query('elderId') elderId?: string) {
    return this.emergencyService.listEvents(elderId);
  }

  @Post('events')
  triggerEvent(@Body() dto: TriggerEventDto) {
    return this.emergencyService.trigger(
      dto.elderId,
      dto.type,
      dto.description,
    );
  }

  @Get('events/:eventId')
  getEvent(@Param('eventId') eventId: string) {
    return this.emergencyService.getEventDetail(eventId);
  }

  /** 发起 / 重试分级呼叫（自动逐级转拨） */
  @Post('events/:eventId/cascade')
  startCascade(@Param('eventId') eventId: string) {
    return this.emergencyService.startCascade(eventId);
  }

  /** 管家标记当前振铃通话结果（模拟语音平台回调） */
  @Post('events/:eventId/attempts/:attemptId/settle')
  settleCall(
    @Param('eventId') eventId: string,
    @Param('attemptId') attemptId: string,
    @Body() dto: SettleCallDto,
  ) {
    return this.emergencyService.settleCall(
      eventId,
      attemptId,
      dto.outcome,
      dto.talkSeconds,
      dto.note,
    );
  }

  /** 关闭事件并生成处置报告 */
  @Post('events/:eventId/resolve')
  resolveEvent(
    @Param('eventId') eventId: string,
    @Body() dto: ResolveEventDto,
  ) {
    return this.emergencyService.resolveEvent(eventId, dto.resolution);
  }

  @Get('events/:eventId/report')
  staffReport(@Param('eventId') eventId: string) {
    return this.reportService.buildStaffReport(eventId);
  }
}
