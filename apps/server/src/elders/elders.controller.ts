import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EmergencyRepository } from '../common/repository';
import { StaffGuard } from '../common/auth.guards';

@Controller('api/admin/elders')
@UseGuards(StaffGuard)
export class EldersController {
  constructor(private readonly repo: EmergencyRepository) {}

  @Get()
  list() {
    return this.repo.listElders();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const elder = await this.repo.getElder(id);
    return elder ?? null;
  }
}
