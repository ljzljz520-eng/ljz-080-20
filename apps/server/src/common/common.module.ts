import { Global, Module } from '@nestjs/common';
import { EmergencyRepository } from './repository';
import { InMemoryEmergencyRepository } from './in-memory.repository';
import { SupabaseEmergencyRepository } from './supabase.repository';
import { StaffGuard, FamilyAuthGuard } from './auth.guards';

/**
 * 全局共享模块：统一提供数据仓储抽象与鉴权守卫。
 * 配置真实 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 时自动切换到 Supabase。
 */
@Global()
@Module({
  providers: [
    InMemoryEmergencyRepository,
    SupabaseEmergencyRepository,
    {
      provide: EmergencyRepository,
      useFactory: (
        inMemory: InMemoryEmergencyRepository,
        supabase: SupabaseEmergencyRepository,
      ): EmergencyRepository => {
        const url = process.env.SUPABASE_URL;
        const hasRealSupabase =
          url &&
          !url.includes('placeholder') &&
          process.env.SUPABASE_SERVICE_ROLE_KEY;
        return hasRealSupabase ? supabase : inMemory;
      },
      inject: [InMemoryEmergencyRepository, SupabaseEmergencyRepository],
    },
    StaffGuard,
    FamilyAuthGuard,
  ],
  exports: [EmergencyRepository, StaffGuard, FamilyAuthGuard],
})
export class CommonModule {}
