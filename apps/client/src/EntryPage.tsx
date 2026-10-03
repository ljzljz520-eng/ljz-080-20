import "./entry.less";

export default function EntryPage() {
  return (
    <div className="entry-page">
      <div className="entry-hero">
        <div className="entry-logo">🛡️</div>
        <h1>颐养应急守护平台</h1>
        <p>紧急联系人分级呼叫 · 自动转接 · 处置留痕 · 家属可视</p>
      </div>
      <div className="entry-cards">
        <a className="entry-card pc" href="/admin">
          <div className="entry-icon">🖥️</div>
          <h2>管家管理端</h2>
          <p>
            配置家属/邻里/社区医生/物业呼叫优先级，触发事件后实时监控分级呼叫、代为处置并结案
          </p>
          <span className="entry-link">进入 PC 工作台 →</span>
        </a>
        <a className="entry-card h5" href="/m">
          <div className="entry-icon">📱</div>
          <h2>家属 H5 端</h2>
          <p>
            凭家属令牌查看与自己相关的突发事件处置报告，其他联系人信息隐私保护不可见
          </p>
          <span className="entry-link">进入家属端 →</span>
        </a>
      </div>
      <footer>应急场景演示系统 · 真实部署请对接语音网关与 Supabase</footer>
    </div>
  );
}
