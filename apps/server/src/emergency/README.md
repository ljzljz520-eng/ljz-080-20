# 紧急联系人分级呼叫模块

面向养老照护场景：每位老人可设置**家属、邻里、社区医生、物业**四类联系人的呼叫优先级；
突发事件发生后系统**自动按级别依次外呼**，第一个联系人未接听会**自动转拨下一位**，
无需管家手动翻通讯录；全过程记录每一通呼叫的接通结果；事件结束后生成简短处置报告，
**家属端只能看到与本人相关的部分**。

## 目录结构

```
src/emergency/
├── emergency.types.ts          # 领域模型 / 枚举与中文标签
├── emergency.module.ts         # 模块装配
├── dto/emergency.dto.ts        # 入参类型
├── repository/
│   ├── memory.store.ts         # 内存数据存储（演示 / 测试用）
│   └── emergency.repository.ts # 仓储：老人 / 联系人 / 事件 / 拨打记录查询
├── call/
│   └── call.gateway.ts         # 电话外呼网关（模拟；真实环境替换为云呼叫 SDK）
├── controllers/
│   ├── staff.controller.ts     # 管家工作台接口 /api/staff/*
│   └── family.controller.ts    # 家属 H5 接口 /api/family/*（令牌鉴权 + 数据过滤）
└── services/
    ├── contacts.service.ts     # 老人档案、联系人分级管理（含演示种子数据）
    ├── emergency.service.ts    # 突发事件 + 分级呼叫编排（核心）
    ├── report.service.ts       # 处置报告（工作人员完整版 / 家属过滤版）
    └── *.spec.ts               # 级联逻辑单元测试
```

## 状态机

```
触发事件 ──► pending ──发起呼叫──► calling ──某级接通──► answered ──管家关闭──► resolved
                                   │
                                   └──全部未接──► failed（可重新发起）
```

- `pending`：事件已建，待发起呼叫
- `calling`：正在按优先级逐级振铃（振铃超时自动转下一位）
- `answered`：某级联系人已接通，等待现场处置
- `resolved`：管家补录处置小结并关闭，报告生成
- `failed`：全部联系人未接通，提示走线下兜底

## 分级呼叫规则（EmergencyService.runCascade）

1. 取该老人所有「启用中」联系人，按 `priority` 升序排队（同优先级按创建时间）。
2. 逐级创建 `call_attempts` 记录（L1、L2 …），调用 `CallGateway.dial()` 振铃。
3. 振铃超时（默认 20s，`CALL_RING_TIMEOUT_MS` 可配）/ 挂断 / 无法接通
   → 自动记录结果并在短间隔（`CALL_NEXT_GAP_MS`，默认 0.8s）后转拨下一位。
4. 任一联系人接通 → 写 `answeredContactId`、停止后续呼叫。
5. 全员未接 → 事件 `failed`。
6. 管家也可在管理端对当前振铃通话提前标记结果（等价于真实语音平台 Webhook 回调）。

## 处置报告的可见性（report.service.ts）

| 内容 | 工作人员版 `/staff/events/:id/report` | 家属版 `/family/events/:id/report` |
| --- | --- | --- |
| 事件概况（类型/描述/时间） | ✅ | ✅（仅限自家老人） |
| 全部联系人姓名/电话/结果 | ✅（电话脱敏） | ❌ |
| **本人**那条呼叫记录 | ✅ | ✅ |
| 其他联系人的记录 | ✅ | ❌ |
| 是谁接通的 | 完整姓名 | 仅「您本人 / 其他应急联系人 / 社区工作人员」 |
| 老人是否已获帮助 | ✅ | ✅ |
| 处置小结 | 完整原文 | 统一脱敏话术 |

家属凭 `familyToken`（创建家属联系人时自动生成）访问，支持
`x-family-token` 请求头或 `?token=` 查询参数；令牌无效、联系人停用、
越权访问其他老人事件均返回错误。

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/staff/elders` | 老人列表 |
| POST | `/api/staff/elders` | 新建老人 |
| GET/POST | `/api/staff/elders/:id/contacts` | 联系人列表 / 新增 |
| PUT/DELETE | `/api/staff/elders/:id/contacts/:cid` | 修改 / 删除 |
| PATCH | `.../contacts/:cid/toggle` | 启停用 |
| POST | `.../contacts/reorder` | 按顺序整体重排优先级 |
| GET | `.../family-bindings` | 家属访问令牌（生成 H5 分享链接） |
| GET/POST | `/api/staff/events` | 事件列表 / 上报突发事件 |
| GET | `/api/staff/events/:id` | 事件详情（含时间线、当前振铃） |
| POST | `/api/staff/events/:id/cascade` | 发起 / 重新发起分级呼叫 |
| POST | `/api/staff/events/:id/attempts/:aid/settle` | 标记当前通话结果 |
| POST | `/api/staff/events/:id/resolve` | 关闭事件并生成报告 |
| GET | `/api/staff/events/:id/report` | 工作人员完整报告 |
| GET | `/api/family/me` | 家属身份（令牌鉴权） |
| GET | `/api/family/events` | 与该家属相关的事件 |
| GET | `/api/family/events/:id/report` | 家属过滤版报告 |

## 接入 Supabase / 真实语音网关

- 表结构见 `sql/emergency_schema.sql`（含 RLS 模板）。实现一个
  `SupabaseEmergencyRepository` 暴露与 `EmergencyRepository` 相同的方法，
  在 `EmergencyModule` 中按 `SUPABASE_URL` 是否配置切换 provider 即可，
  Service / Controller 无需改动。
- `CallGateway` 目前用「定时器振铃 + 人工 settle」模拟。真实环境把 `dial()`
  换成云呼叫中心外呼、把语音平台的接听/挂断 Webhook 路由到
  `emergencyService.settleCall(...)` 即可，级联状态机不变。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 后端监听端口（容器内） |
| `CALL_RING_TIMEOUT_MS` | `20000` | 单通振铃超时，超时自动转下一位 |
| `CALL_NEXT_GAP_MS` | `800` | 转拨下一位前的间隔 |

## 演示账号（种子数据）

| 老人 | 家属访问码（H5 令牌） |
| --- | --- |
| 王秀兰（3-2-501） | `ft-wang-son-demo`（长子）、`ft-wang-daughter-demo`（女儿） |
| 赵德海（7-1-302） | `ft-zhao-son-demo`（儿子） |
