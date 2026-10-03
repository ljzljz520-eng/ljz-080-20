# 幸福里 · 智慧照护平台

面向社区养老场景的前后端单仓项目，已实现**紧急联系人分级呼叫模块**。

## 技术栈

- **前端（管理端 PC + 家属端 H5，同一 React 应用双入口）**：React 19 + TypeScript +
  Vite + React Router v7 + antd（PC）+ antd-mobile（H5）+ LESS
- **后端**：Node.js 20 + NestJS 11 + TypeScript
- **数据库**：Supabase（Postgres），建表脚本见 `apps/server/sql/emergency_schema.sql`
  （当前运行时使用内存仓储，可零依赖直接演示；接入 Supabase 的切换方式见模块 README）

## 项目结构

```
apps/
  client/
    src/
      api/                 # 统一 API 客户端与共享类型
      pages/
        Landing.tsx        # 入口选择页
        admin/             # 管理端（PC）：工作台 / 联系人分级 / 事件处置 / 报告
        h5/                # 家属端（H5）：事件列表 / 本人相关报告
  server/
    src/emergency/         # 紧急联系人分级呼叫模块（详见模块内 README）
```

## 功能说明（紧急联系人分级呼叫）

1. 每位老人可设置**家属 / 邻里 / 社区医生 / 物业**联系人，并指定呼叫优先级
   （L1、L2…，支持拖拽式上下调整、启停用、自动顺延）。
2. 管家上报突发事件（跌倒 / 突发疾病 / 火情 / 非法闯入 / 其他）后，
   系统**自动从最高优先级开始外呼**；第一位未接听（超时 / 挂断 / 无法接通）时
   **自动转拨下一位**，管家无需手动翻通讯录。
3. 管理端实时展示分级呼叫时间线：当前振铃人呼吸高亮，可一键标记
   「已接通 / 无人接听 / 挂断 / 无法接通」（等同真实语音平台回调）。
4. 每一通呼叫的结果、时间、通话时长都有记录；任意一位接通即停止继续呼叫；
   全部未接则事件进入「全部未接」，提示线下兜底，并可重新发起。
5. 事件结束（管家补录处置小结）后生成**简短处置报告**。
6. **家属端报告分级可见**：家属凭专属访问码进入 H5，只能看到事件概况、
   老人是否已获帮助、以及**与自己相关的那一条呼叫记录**，看不到其他联系人
   的姓名电话与处置细节；越权访问其他老人事件会被拒绝。

## 本地运行

```bash
# 后端（默认内存数据，首次启动自动播种演示数据）
cd apps/server
npm install
npm run start:dev          # http://localhost:3000/api

# 前端
cd apps/client
npm install
npm run dev                # http://localhost:3000 （/api 自动代理到 3000）
```

或使用 Docker：`docker compose up`（前端 http://localhost:3000，
后端 http://localhost:8000，数据库 localhost:5432）。

## 快速体验

1. 打开管理端 `http://localhost:3000/admin/events` →「上报突发事件」，
   选择老人与事件类型，系统即刻开始分级呼叫。
2. 在事件详情页观察 L1 振铃：点「无人接听，立即转下一位」，系统自动转 L2；
   在 L2 点「对方已接通」，级联停止；补录处置小结后关闭事件生成报告。
   （不点任何按钮时，单通电话会在 `CALL_RING_TIMEOUT_MS` 后超时自动转拨。）
3. 打开家属端 `http://localhost:3000/h5`，输入访问码
   `ft-wang-daughter-demo`（女儿）或 `ft-wang-son-demo`（长子），
   对比两人看到的报告——各自只能看到本人相关片段。

## 测试

```bash
cd apps/server && npm test     # 级联呼叫核心逻辑 6 个用例
```

覆盖：优先级排队、未接自动转拨、接通即停、全员未接 failed、无联系人拒绝发起、
家属报告的数据隔离。
