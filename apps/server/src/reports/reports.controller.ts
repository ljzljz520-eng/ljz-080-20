import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { StaffGuard } from '../common/auth.guards';

@Controller('api/admin/reports')
@UseGuards(StaffGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /** 全部处置报告（管家视角，含完整呼叫明细由事件详情接口提供） */
  @Get()
  list(@Query('elderId') elderId?: string) {
    return this.reportsService.listReports(elderId);
  }

  @Get('events/:eventId')
  byEvent(@Param('eventId') eventId: string) {
    return this.reportsService.getReport(eventId);
  }
}
