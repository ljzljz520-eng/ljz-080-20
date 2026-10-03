import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Contact } from './types';

export const CurrentFamilyContact = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Contact => {
    const req = ctx.switchToHttp().getRequest();
    return req.familyContact as Contact;
  },
);
