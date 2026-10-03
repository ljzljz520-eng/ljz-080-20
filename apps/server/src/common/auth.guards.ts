import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { EmergencyRepository } from './repository';

/**
 * 管理端（管家/运营）访问守卫。
 * 演示项目使用固定令牌；生产环境应对接 SSO / 会话体系。
 */
@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.header('x-staff-token');
    if (!token) {
      throw new UnauthorizedException('缺少管理端令牌（x-staff-token）');
    }
    return true;
  }
}

/** 家属端访问守卫：校验 x-family-token，绑定对应联系人记录 */
@Injectable()
export class FamilyAuthGuard implements CanActivate {
  constructor(private readonly repo: EmergencyRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { familyContact?: unknown }>();
    const token = req.header('x-family-token');
    if (!token) {
      throw new UnauthorizedException('缺少家属访问令牌（x-family-token）');
    }
    const contact = await this.repo.findContactByToken(token);
    if (!contact || contact.role !== 'family') {
      throw new UnauthorizedException('家属访问令牌无效');
    }
    req.familyContact = contact;
    return true;
  }
}
