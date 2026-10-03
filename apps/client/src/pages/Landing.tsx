import { Link } from 'react-router-dom';
import './landing.less';

export default function Landing() {
  return (
    <div className="landing">
      <div className="landing-inner">
        <div className="landing-brand">
          <span className="brand-mark">护</span>
          <div>
            <h1>幸福里 · 智慧照护平台</h1>
            <p>紧急联系人分级呼叫 · 突发事件自动逐级联系 · 处置报告分级可见</p>
          </div>
        </div>

        <div className="entry-grid">
          <Link to="/admin/events" className="entry-card entry-admin">
            <div className="entry-icon">🧑‍💼</div>
            <div className="entry-name">管理端（PC）</div>
            <div className="entry-desc">
              管家工作台：设置联系人优先级、接收突发事件、监控分级呼叫、生成处置报告
            </div>
            <div className="entry-cta">进入工作台 →</div>
          </Link>

          <Link to="/h5" className="entry-card entry-h5">
            <div className="entry-icon">📱</div>
            <div className="entry-name">家属端（H5）</div>
            <div className="entry-desc">
              家属凭专属访问码查看老人事件进展与本人相关的处置报告
            </div>
            <div className="entry-cta">家属查看入口 →</div>
          </Link>
        </div>

        <div className="demo-tip">
          🧪 演示账号（家属访问码）：
          <code>ft-wang-son-demo</code>（王秀兰长子）、
          <code>ft-wang-daughter-demo</code>（女儿）、
          <code>ft-zhao-son-demo</code>（赵德海儿子）
        </div>
      </div>
    </div>
  );
}
