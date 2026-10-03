# 紧急联系人分级呼叫模块（后端）

NestJS + TypeScript。为每位老人维护「家属 / 邻里 / 社区医生 / 物业」四类紧急
联系人及优先级，突发事件触发后系统按 P1 → Pn 自动逐级外呼，未接听自动转接
下一位，全过程留痕；事件结案自动生成简短处置报告，家属 H5 端只能看到与本人
相关的内容。

## 运行

```bash
npm install
npm run start:dev        # http://localhost:3000
npm test                 # 单元测试（分级引擎 + 家属脱敏）
```

默认使用**内存仓储**（含演示种子数据，零外部依赖；数据随重启重置）。
配置真实环境变量 `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 后自动切换到
Supabase 仓储，建表脚本见 `sql/001_emergency_schema.sql`。

## 核心机制

1. **分级呼叫引擎**（`emergency/emergency.service.ts`）
   - 触发事件 → 取启用中、未呼叫过、优先级最高的联系人外呼；
   - `no_answer / rejected / failed` → 自动转接下一位，`escalation_count + 1`；
   - `answered` → 锁定第一响应人，停止呼叫，等待管家结案；
   - 名单全部轮询完毕 → 事件置为 `exhausted`，提示管家直接介入；
   - 语音通道（`dialer.service.ts`）为模拟实现，生产环境替换为真实语音网关
     SDK 或在网关回调中调用 `/events/:id/call-result`。
2. **结果留痕**：每一次外呼写入 `call_attempts`（振铃/接通/拒接/失败、时长、备注）。
3. **处置报告**：结案时自动生成摘要 + 分级动作清单（`reports.service.ts`）。
4. **家属隐私视图**：`/api/family/reports` 仅返回本人呼叫明细；其他联系人只
   返回数量统计（总人次/接通/未接），不返回姓名、电话、关系。

## API

管理端需请求头 `x-staff-token`；家属端需 `x-family-token`（家属联系人的
access_token，由管家在 PC 端签发/重置）。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/elders` | 老人列表 |
| GET/POST | `/api/admin/contacts` | 联系人列表 / 新增（家属自动签发令牌） |
| PATCH/DELETE | `/api/admin/contacts/:id` | 编辑 / 删除 |
| PUT | `/api/admin/contacts/reorder/:elderId` | 拖拽后整体重排优先级 |
| POST | `/api/admin/contacts/:id/rotate-token` | 重新签发家属令牌 |
| POST | `/api/admin/events` | 触发突发事件（body 可带 `simulate` 演示首轮结果） |
| GET | `/api/admin/events` / `/:id` | 事件列表 / 详情（含呼叫记录、报告） |
| POST | `/api/admin/events/:id/call-result` | 网关回调或管家代操作：answered/rejected/failed |
| POST | `/api/admin/events/:id/resolve` | 结案并自动生成报告 |
| GET | `/api/admin/reports` | 处置报告列表 |
| GET | `/api/family/me` | 当前家属身份 |
| GET | `/api/family/reports` | 家属脱敏后的处置报告视图 |

## 演示账号（内存仓储种子数据）

- 管家端令牌：任意非空 `x-staff-token`（前端默认 `demo-staff-token`）
- 家属令牌：`family-demo-wangxm`（王秀兰长子王晓明）、`family-demo-lina`（李建国女儿李娜）
