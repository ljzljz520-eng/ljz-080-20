import { useCallback, useEffect, useState } from "react";
import { App as AntApp, Button, Drawer, Empty, Tag } from "antd";
import { api } from "../../api/client";
import type { Elder, EmergencyEvent, EventReport } from "../../api/types";
import ElderPicker from "../ElderPicker";
import EventTimeline from "../components/EventTimeline";
import type { EventDetail } from "../../api/types";
import {
  OUTCOME_COLOR,
  OUTCOME_LABEL,
  SEVERITY_META,
  fmtTime,
} from "../../common/format";
import "./reports.less";

interface Row {
  report: EventReport;
  event: EmergencyEvent;
}

export default function ReportsPage({
  elder,
  onElderChange,
}: {
  elder?: Elder;
  onElderChange: (e: Elder | undefined) => void;
}) {
  const { message } = AntApp.useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<EventDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(
        await api.get<Row[]>(
          `/api/admin/reports${elder ? `?elderId=${elder.id}` : ""}`,
        ),
      );
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [elder, message]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (eventId: string) => {
    setDetail(await api.get<EventDetail>(`/api/admin/events/${eventId}`));
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="title-block">
          <h1>📄 处置报告</h1>
          <p>
            事件结案后自动生成；管理端可见完整通话明细，家属端仅可见与本人相关部分
          </p>
        </div>
        <ElderPicker elder={elder} onChange={onElderChange} />
      </div>

      <div className="report-list">
        {!loading && rows.length === 0 && (
          <div className="card empty-state">
            <Empty description="暂无已结案事件的处置报告" />
          </div>
        )}
        {rows.map(({ report, event }) => {
          const sev = SEVERITY_META[event.severity];
          return (
            <div className="card report-card" key={report.id}>
              <div className="report-card-head">
                <div>
                  <div className="report-title-line">
                    <Tag color={sev.color} style={{ marginRight: 8 }}>
                      {sev.label}
                    </Tag>
                    <h3>{event.title}</h3>
                  </div>
                  <div className="report-meta">
                    <span>事件编号：{event.id}</span>
                    <span>发生：{fmtTime(event.startedAt)}</span>
                    <span>结案：{fmtTime(event.resolvedAt)}</span>
                  </div>
                </div>
                <Button
                  type="primary"
                  ghost
                  onClick={() => openDetail(event.id)}
                >
                  查看完整报告
                </Button>
              </div>
              <p className="report-summary">{report.summary}</p>
            </div>
          );
        })}
      </div>

      <Drawer
        title="处置报告详情（管家视角·完整）"
        width={640}
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div className="report-detail">
            <section>
              <div className="section-title">事件概要</div>
              <p>{detail.report?.summary}</p>
              <div className="kv-grid">
                <div>
                  <label>老人</label>
                  <span>{detail.elder.name}</span>
                </div>
                <div>
                  <label>地址</label>
                  <span>{detail.elder.address ?? "—"}</span>
                </div>
                <div>
                  <label>触发人</label>
                  <span>{detail.event.initiatedBy}</span>
                </div>
                <div>
                  <label>报告生成</label>
                  <span>{fmtTime(detail.report?.generatedAt)}</span>
                </div>
              </div>
            </section>

            <section>
              <div className="section-title">分级呼叫明细</div>
              <EventTimeline detail={detail} />
            </section>

            <section>
              <div className="section-title">处置经过</div>
              <ol className="actions-list">
                {detail.report?.actions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ol>
            </section>

            <section>
              <div className="section-title">最终处置结果</div>
              <div className="final-resolution">{detail.event.resolution}</div>
            </section>

            <section>
              <div className="section-title">呼叫结果统计</div>
              <div className="outcome-stat-row">
                {(["answered", "no_answer", "rejected", "failed"] as const).map(
                  (o) => {
                    const n = detail.attempts.filter(
                      (a) => a.outcome === o,
                    ).length;
                    return (
                      <div className="outcome-stat" key={o}>
                        <b style={{ color: OUTCOME_COLOR[o] }}>{n}</b>
                        <span>{OUTCOME_LABEL[o]}</span>
                      </div>
                    );
                  },
                )}
              </div>
            </section>
          </div>
        )}
      </Drawer>
    </div>
  );
}
