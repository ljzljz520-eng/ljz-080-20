import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { FamilyController } from './family.controller';

@Module({
  controllers: [ReportsController, FamilyController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
