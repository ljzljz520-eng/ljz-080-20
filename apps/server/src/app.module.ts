import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { ContactsModule } from './contacts/contacts.module';
import { EldersModule } from './elders/elders.module';
import { EmergencyModule } from './emergency/emergency.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    CommonModule,
    ContactsModule,
    EldersModule,
    EmergencyModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
