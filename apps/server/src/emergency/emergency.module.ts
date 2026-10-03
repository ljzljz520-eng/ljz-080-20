import { Module } from '@nestjs/common';
import { MemoryStore } from './repository/memory.store';
import { EmergencyRepository } from './repository/emergency.repository';
import { CallGateway } from './call/call.gateway';
import { ContactsService } from './services/contacts.service';
import { EmergencyService } from './services/emergency.service';
import { ReportService } from './services/report.service';
import { StaffController } from './controllers/staff.controller';
import { FamilyController } from './controllers/family.controller';

/**
 * 紧急联系人分级呼叫模块。
 *
 * 装配说明：
 * - MemoryStore / EmergencyRepository 当前为内存实现；
 *   接入 Supabase 时新增 SupabaseEmergencyRepository（实现相同仓储接口），
 *   在此按 SUPABASE_URL 是否可用切换 provider 即可。
 */
@Module({
  controllers: [StaffController, FamilyController],
  providers: [
    MemoryStore,
    EmergencyRepository,
    CallGateway,
    ContactsService,
    EmergencyService,
    ReportService,
  ],
  exports: [EmergencyService, ContactsService, ReportService],
})
export class EmergencyModule {}
