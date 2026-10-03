import { Module } from '@nestjs/common';
import { EldersController } from './elders.controller';

@Module({
  controllers: [EldersController],
})
export class EldersModule {}
