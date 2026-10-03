import type { EventDetail } from "../../api/types";
import {
  OUTCOME_COLOR,
  OUTCOME_LABEL,
  ROLE_COLOR,
  ROLE_LABEL,
  fmtDuration,
  fmtTime,
} from "../../common/format";
import "./timeline.less";

export default function EventTimeline({ detail }: { detail: EventDetail }) {
  const { attempts, event } = detail;
  if (attempts.length === 0) return null;

  return (
    <div className="call-timeline">
      <div className="timeline-title">📞 分级呼叫记录（{attempts.length}）</div>
      <div className="timeline-track">
        {attempts.map((a, idx) => {
          const isCurrent = a.contactId === event.currentContactId;
          return (
            <div
              className={`timeline-item ${isCurrent ? "current" : ""}`}
              key={a.id}
            >
              <div
                className="step-dot"
                style={{ background: OUTCOME_COLOR[a.outcome] }}
              >
                {a.priority}
              </div>
              {idx < attempts.length - 1 && (
                <div
                  className="step-link"
                  style={{
                    background:
                      a.outcome === "answered" ? "#52c41a" : "#d1d5db",
                  }}
                />
              )}
              <div className="step-card">
                <div className="step-head">
                  <span
                    className="tag"
                    style={{
                      color: "#fff",
                      background: ROLE_COLOR[a.contact.role],
                    }}
                  >
                    P{a.priority} {ROLE_LABEL[a.contact.role]}
                  </span>
                  <b className="step-name">{a.contact.name}</b>
                  <span
                    className="tag"
                    style={{
                      color: OUTCOME_COLOR[a.outcome],
                      background: `${OUTCOME_COLOR[a.outcome]}1a`,
                      marginLeft: "auto",
                    }}
                  >
                    {a.outcome === "ringing" && (
                      <span className="ringing-dot" />
                    )}
                    {OUTCOME_LABEL[a.outcome]}
                  </span>
                </div>
                <div className="step-meta">
                  <span>📱 {a.contact.phone}</span>
                  <span>🕒 {fmtTime(a.startedAt)}</span>
                  {a.durationSec != null && (
                    <span>⏱ {fmtDuration(a.durationSec)}</span>
                  )}
                </div>
                {a.remark && <div className="step-remark">{a.remark}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
