import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmergencyModule } from './emergency/emergency.module';

@Module({
  imports: [EmergencyModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
