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
  UseGuards,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import type { UpsertContactDto } from './contacts.service';
import { StaffGuard } from '../common/auth.guards';

@Controller('api/admin/contacts')
@UseGuards(StaffGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  list(@Query('elderId') elderId?: string) {
    return this.contactsService.list(elderId);
  }

  @Post()
  create(@Body() dto: UpsertContactDto) {
    return this.contactsService.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contactsService.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() patch: Partial<UpsertContactDto>) {
    return this.contactsService.update(id, patch);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contactsService.remove(id);
  }

  @Put('reorder/:elderId')
  reorder(
    @Param('elderId') elderId: string,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.contactsService.reorder(elderId, body.orderedIds ?? []);
  }

  @Post(':id/rotate-token')
  rotate(@Param('id') id: string) {
    return this.contactsService.rotateToken(id);
  }
}
