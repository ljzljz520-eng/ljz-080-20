import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EmergencyService } from './emergency.service';
import type {
  CallCallbackDto,
  ResolveEventDto,
  TriggerEventDto,
} from './emergency.service';
import { StaffGuard } from '../common/auth.guards';

@Controller('api/admin/events')
@UseGuards(StaffGuard)
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  /** 事件列表（管家看板） */
  @Get()
  list(@Query('elderId') elderId?: string) {
    return this.emergencyService.list(elderId);
  }

  /** 事件详情：含老人信息、每一级呼叫记录与接通结果、处置报告 */
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.emergencyService.getDetail(id);
  }

  /** 触发突发事件，系统自动按优先级开始分级呼叫 */
  @Post()
  trigger(@Body() dto: TriggerEventDto) {
    return this.emergencyService.trigger(dto);
  }

  /** 语音网关回调 / 管家代操作：接通、拒接、呼叫失败（未接听由超时自动处理） */
  @Post(':id/call-result')
  callResult(@Param('id') id: string, @Body() dto: CallCallbackDto) {
    return this.emergencyService.notifyCallResult(id, dto);
  }

  /** 管家结案，自动生成处置报告 */
  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body() dto: ResolveEventDto) {
    return this.emergencyService.resolve(id, dto);
  }
}
