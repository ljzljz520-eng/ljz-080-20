# 颐养应急守护平台

React 双入口前端（管家 PC 端 + 家属 H5 端）+ NestJS 后端 + Supabase(Postgres)
的 monorepo。

## 紧急联系人分级呼叫模块

- 每位老人可配置 **家属 / 邻里 / 社区医生 / 物业** 四类联系人及 P1…Pn 优先级；
- 突发事件触发后，系统按优先级**自动逐级外呼**，第一位未接听（超时/拒接/失败）
  即自动转接下一位，管家无需手动翻通讯录；
- 每一次呼叫的振铃、接通结果、时长全程记录，实时回传指挥台；
- 有人接通即锁定第一响应人；全部未接通则标记「待人工介入」；
- 事件结案后自动生成**简短处置报告**（摘要 + 分级动作清单）；
- **家属 H5 端只能看到与自己相关的呼叫结果与处置摘要**，其他联系人仅做
  数量统计，不透露姓名/电话/关系。

## 目录

```
apps/
  client/                 # React 前端（/admin 管家端，/m 家属端）
  server/                 # NestJS 后端（分级引擎、模拟语音通道、报告、脱敏）
    sql/                  # Supabase/Postgres 建表脚本（含 RLS）
```

## 快速开始（无需数据库，内存模式）

```bash
# 1. 后端（默认 3000 端口，内置演示老人/联系人数据）
cd apps/server && npm run start:dev

# 2. 前端（新终端）
cd apps/client && VITE_API_TARGET=http://localhost:3000 npm run dev
# 打开 http://localhost:3000/  → 管家端 /admin，家属端 /m
```

- 家属端演示令牌：`family-demo-wangxm`、`family-demo-lina`
- 管理端令牌：任意非空值（前端默认已填）

## Docker

```bash
docker compose up        # frontend :3000, backend :8000, db :5432
```

## 接入 Supabase

1. 在 Supabase SQL Editor 执行 `apps/server/sql/001_emergency_schema.sql`；
2. 配置后端环境变量 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`（见
   `apps/server/.env.example`），后端自动从内存仓储切换到 Supabase 仓储。

## 接入真实语音网关

替换/对接 `apps/server/src/emergency/dialer.service.ts`：由网关回调
`POST /api/admin/events/:id/call-result`（answered / rejected / no_answer /
failed）驱动自动转接；分级引擎本身与通道实现解耦。

## 测试

```bash
cd apps/server && npm test   # 分级引擎（自动转接/耗尽/结案）+ 家属脱敏单测
```

## 技术栈

- 前端：React 19、TypeScript、Vite、React Router、antd（PC）、antd-mobile（H5）、LESS
- 后端：Node.js 20、NestJS 11、TypeScript、Supabase JS
