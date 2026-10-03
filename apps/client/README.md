# 前端（双入口）

React 19 + TypeScript + Vite。单应用内提供两个入口：

- **管家 PC 管理端**：`/admin`（antd）
  - 应急指挥台：触发突发事件、实时查看分级呼叫进度（3s 轮询）、模拟接通/
    拒接/失败、人工结案
  - 分级联系人：维护家属/邻里/社区医生/物业及 P1…Pn 优先级（上移/下移）、
    启用停用、家属访问令牌签发
  - 处置报告：完整报告抽屉（全量通话明细 + 处置经过 + 结果统计）
- **家属 H5 端**：`/m`（antd-mobile）
  - 令牌登录；仅展示与本人相关的呼叫记录；其他联系人仅显示脱敏数量统计
- `/` 为入口引导页。

## 运行

```bash
npm install
# 本地联调时把 API 代理到本机后端（默认代理 http://localhost:8000）
VITE_API_TARGET=http://localhost:3000 npm run dev
npm run build
```

## 演示令牌

- 家属端：`family-demo-wangxm` / `family-demo-lina`
