import { useState } from "react";
import { Card, Collapse, Tag } from "antd-mobile";
import type { FamilyReportView } from "../api/types";
import {
  OUTCOME_COLOR,
  OUTCOME_LABEL,
  SEVERITY_META,
  fmtDuration,
  fmtTime,
} from "../common/format";

export default function ReportCard({ view }: { view: FamilyReportView }) {
  const [open, setOpen] = useState(false);
  const sev = SEVERITY_META[view.event.severity];
  const ownAnswered = view.ownAttempts.some((a) => a.outcome === "answered");

  return (
    <Card className="h5-report-card">
      <div className="rc-head">
        <Tag
          color={
            sev.color === "#ca8a04"
              ? "warning"
              : sev.color === "#ea580c"
                ? "warning"
                : "danger"
          }
        >
          {sev.label}
        </Tag>
        <b className="rc-title">{view.event.title}</b>
      </div>
      <div className="rc-sub">
        <span>👵 {view.elderName}</span>
        <span>🕒 {fmtTime(view.event.startedAt)}</span>
      </div>

      <div className={`rc-answer-banner ${ownAnswered ? "me-answered" : ""}`}>
        {view.answeredByMe ? (
          <>✅ 本次事件中由您首先接通电话，感谢您的及时响应</>
        ) : (
          <>
            {ownAnswered ? "您已接通本次呼叫" : "本次事件中系统曾尝试与您联系"}
          </>
        )}
      </div>

      {/* 与家属本人直接相关的呼叫记录 */}
      <div className="rc-section">
        <div className="rc-section-title">📞 与您相关的呼叫记录</div>
        {view.ownAttempts.map((a, i) => (
          <div className="rc-attempt" key={i}>
            <div className="rc-attempt-main">
              <span
                className="tag"
                style={{ color: "#fff", background: OUTCOME_COLOR[a.outcome] }}
              >
                {OUTCOME_LABEL[a.outcome]}
              </span>
              <span className="rc-attempt-p">P{a.priority} 优先级</span>
            </div>
            <div className="rc-attempt-meta">
              呼叫时间 {fmtTime(a.startedAt)}
              {a.durationSec != null && a.durationSec > 0
                ? ` · 时长 ${fmtDuration(a.durationSec)}`
                : ""}
            </div>
            {a.remark && a.outcome !== "answered" && (
              <div className="rc-attempt-remark">{a.remark}</div>
            )}
          </div>
        ))}
      </div>

      {/* 其他联系人：只给脱敏统计 */}
      <div className="rc-section rc-others">
        <div className="rc-section-title">🔒 其他联络人情况（隐私保护）</div>
        <div className="rc-others-stat">
          <div className="rc-others-item">
            <b>{view.othersSummary.total}</b>
            <span>其他呼叫人次</span>
          </div>
          <div className="rc-others-item">
            <b style={{ color: "#16a34a" }}>{view.othersSummary.answered}</b>
            <span>已接通</span>
          </div>
          <div className="rc-others-item">
            <b style={{ color: "#d97706" }}>
              {view.othersSummary.noAnswer + view.othersSummary.rejected}
            </b>
            <span>未接/拒接</span>
          </div>
        </div>
        <div className="rc-others-note">
          为保护各方隐私，其他家属、邻里、医生及物业的身份信息不予展示
        </div>
      </div>

      <Collapse
        activeKey={open ? ["1"] : []}
        onChange={(keys) => setOpen(keys.length > 0)}
      >
        <Collapse.Panel key="1" title="查看事件处置摘要">
          <p className="rc-summary">{view.report.summary}</p>
          <div className="rc-resolution">
            <div className="rc-resolution-label">管家现场处置</div>
            {view.event.resolution}
          </div>
          <div className="rc-resolved-at">
            结案时间：{fmtTime(view.event.resolvedAt)}
          </div>
        </Collapse.Panel>
      </Collapse>
    </Card>
  );
}
