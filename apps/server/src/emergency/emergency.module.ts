import { Module } from '@nestjs/common';
import { EmergencyController } from './emergency.controller';
import { EmergencyService } from './emergency.service';
import { DialerService } from './dialer.service';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [ReportsModule],
  controllers: [EmergencyController],
  providers: [EmergencyService, DialerService],
  exports: [EmergencyService, DialerService],
})
export class EmergencyModule {}
