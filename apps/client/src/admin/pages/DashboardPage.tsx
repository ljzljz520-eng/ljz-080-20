import { useCallback, useEffect, useRef, useState } from "react";
import {
  App as AntApp,
  Badge,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Tag,
} from "antd";
import { api } from "../../api/client";
import type {
  CallOutcome,
  Elder,
  EmergencyEvent,
  EventDetail,
  EventSeverity,
} from "../../api/types";
import ElderPicker from "../ElderPicker";
import {
  OUTCOME_LABEL,
  ROLE_COLOR,
  ROLE_LABEL,
  SEVERITY_META,
  STATUS_META,
  fmtTime,
} from "../../common/format";
import EventTimeline from "../components/EventTimeline";
import ResolveModal from "../components/ResolveModal";
import "./dashboard.less";

interface Props {
  elder?: Elder;
  onElderChange: (e: Elder | undefined) => void;
  bump: () => void;
}

const SEVERITY_OPTIONS: Array<{ value: EventSeverity; label: string }> = [
  { value: "critical", label: "紧急（生命体征异常/跌倒）" },
  { value: "major", label: "较重（走失/长时间未活动）" },
  { value: "minor", label: "一般（误报/轻微不适）" },
];

export default function DashboardPage({ elder, onElderChange }: Props) {
  const { message } = AntApp.useApp();
  const [events, setEvents] = useState<EmergencyEvent[]>([]);
  const [details, setDetails] = useState<Record<string, EventDetail>>({});
  const [loading, setLoading] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<EventDetail | null>(null);
  const [simulate, setSimulate] = useState<CallOutcome>("no_answer");
  const [form] = Form.useForm();
  const busyRef = useRef(false);

  const load = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const list = await api.get<EmergencyEvent[]>(
          `/api/admin/events${elder ? `?elderId=${elder.id}` : ""}`,
        );
        setEvents(list);
        const open = list.filter(
          (e) => e.status === "active" || e.status === "escalating",
        );
        const next: Record<string, EventDetail> = {};
        await Promise.all(
          open.map(async (e) => {
            next[e.id] = await api.get<EventDetail>(
              `/api/admin/events/${e.id}`,
            );
          }),
        );
        setDetails((prev) => ({ ...prev, ...next }));
      } catch (err) {
        if (!silent) message.error((err as Error).message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [elder, message],
  );

  useEffect(() => {
    load();
  }, [load]);

  // 进行中事件 3 秒轮询，实时呈现自动转接进度
  const hasOpen = events.some(
    (e) => e.status === "active" || e.status === "escalating",
  );
  useEffect(() => {
    if (!hasOpen) return;
    const timer = setInterval(() => load(true), 3000);
    return () => clearInterval(timer);
  }, [hasOpen, load]);

  const trigger = async () => {
    const values = await form.validateFields();
    try {
      await api.post("/api/admin/events", {
        elderId: elder?.id,
        ...values,
        initiatedBy: values.initiatedBy || "管家值班台",
        simulate,
      });
      message.success("突发事件已触发，系统开始按优先级分级呼叫");
      setTriggerOpen(false);
      form.resetFields();
      load();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const notify = async (eventId: string, outcome: CallOutcome) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const detail = await api.post<EventDetail>(
        `/api/admin/events/${eventId}/call-result`,
        { outcome },
      );
      setDetails((p) => ({ ...p, [eventId]: detail }));
      message.success(`已记录：${OUTCOME_LABEL[outcome]}`);
      await load(true);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      busyRef.current = false;
    }
  };

  const openCount = events.filter(
    (e) => e.status === "active" || e.status === "escalating",
  ).length;

  return (
    <div className="page-container dashboard">
      <div className="page-header">
        <div className="title-block">
          <h1>
            🚨 应急指挥台{" "}
            {openCount > 0 && <Badge count={openCount} title="进行中事件" />}
          </h1>
          <p>
            触发后系统自动按「家属 → 邻里 → 社区医生 →
            物业」优先级逐级呼叫，未接听自动转接下一位
          </p>
        </div>
        <div className="elder-picker-row">
          <ElderPicker elder={elder} onChange={onElderChange} />
          <Button
            type="primary"
            size="large"
            danger
            onClick={() => setTriggerOpen(true)}
          >
            触发突发事件
          </Button>
        </div>
      </div>

      <div className="event-list" style={{ opacity: loading ? 0.6 : 1 }}>
        {events.length === 0 && (
          <div className="card empty-state">
            暂无事件记录，点击右上角「触发突发事件」开始演练
          </div>
        )}
        {events.map((e) => {
          const detail = details[e.id];
          const meta = STATUS_META[e.status];
          const sev = SEVERITY_META[e.severity];
          const currentContact = detail?.attempts.find(
            (a) => a.contactId === e.currentContactId,
          )?.contact;
          const answeredContact = detail?.attempts.find(
            (a) => a.contactId === e.answeredByContactId,
          )?.contact;
          return (
            <div key={e.id} className="card event-card">
              <div className="event-top">
                <div className="event-title-line">
                  <span
                    className="tag"
                    style={{ color: meta.color, background: meta.bg }}
                  >
                    {e.status === "escalating" && (
                      <span className="ringing-dot" />
                    )}
                    {meta.label}
                  </span>
                  <Tag color={sev.color} style={{ marginRight: 0 }}>
                    {sev.label}
                  </Tag>
                  <h3>{e.title}</h3>
                </div>
                <div className="event-meta">
                  <span>👤 {detail?.elder.name ?? "—"}</span>
                  <span>🕒 {fmtTime(e.startedAt)}</span>
                  <span>🔁 已转接 {e.escalationCount} 次</span>
                </div>
              </div>

              {e.description && (
                <div className="event-desc">{e.description}</div>
              )}

              {e.status === "escalating" && currentContact && (
                <div className="calling-banner">
                  <div className="calling-text">
                    <span className="ringing-dot" />
                    正在呼叫&nbsp;
                    <b>
                      <span
                        className="tag"
                        style={{
                          color: "#fff",
                          background: ROLE_COLOR[currentContact.role],
                          marginRight: 6,
                        }}
                      >
                        P{currentContact.priority}{" "}
                        {ROLE_LABEL[currentContact.role]}
                      </span>
                      {currentContact.name}
                    </b>
                    &nbsp;·&nbsp;{currentContact.phone}
                    <div className="calling-hint">
                      无人接听时将自动转接下一位，无需管家手动翻通讯录
                    </div>
                  </div>
                  <div className="call-actions">
                    <Button
                      size="small"
                      style={{
                        background: "#dcfce7",
                        color: "#15803d",
                        borderColor: "#86efac",
                      }}
                      onClick={() => notify(e.id, "answered")}
                    >
                      ✓ 模拟接通
                    </Button>
                    <Button
                      size="small"
                      onClick={() => notify(e.id, "rejected")}
                    >
                      拒接
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => notify(e.id, "failed")}
                    >
                      呼叫失败
                    </Button>
                  </div>
                </div>
              )}

              {e.status === "active" && answeredContact && (
                <div className="answered-banner">
                  <div>
                    ✅ 已与{" "}
                    <b>
                      {ROLE_LABEL[answeredContact.role]} {answeredContact.name}
                    </b>{" "}
                    接通并建立联系，请安排现场处置后结案
                  </div>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => detail && setResolveTarget(detail)}
                  >
                    填写处置结果并结案
                  </Button>
                </div>
              )}

              {e.status === "exhausted" && (
                <div className="exhausted-banner">
                  <div>
                    ⚠️
                    分级名单已全部轮询完毕仍无人接听，请管家立即直接上门或联系
                    120
                  </div>
                  <Button
                    type="primary"
                    danger
                    size="small"
                    onClick={() => detail && setResolveTarget(detail)}
                  >
                    人工介入处置并结案
                  </Button>
                </div>
              )}

              {detail && <EventTimeline detail={detail} />}

              {(e.status === "active" || e.status === "exhausted") && (
                <div className="event-footer">
                  <Button onClick={() => detail && setResolveTarget(detail)}>
                    结案并生成报告
                  </Button>
                </div>
              )}

              {e.status === "resolved" && e.resolvedAt && (
                <div className="resolution-box">
                  <div className="resolution-label">
                    处置结果（{fmtTime(e.resolvedAt)} 结案）
                  </div>
                  <div>{e.resolution}</div>
                  {detail?.report && (
                    <div className="report-inline">
                      <div className="resolution-label">📄 处置报告摘要</div>
                      <div>{detail.report.summary}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        title="🚨 触发突发事件"
        open={triggerOpen}
        onCancel={() => setTriggerOpen(false)}
        onOk={trigger}
        okText="立即触发分级呼叫"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="title"
            label="事件标题"
            rules={[{ required: true, message: "请输入事件标题" }]}
          >
            <Input placeholder="如：卫生间跌倒报警 / 心率异常" />
          </Form.Item>
          <Form.Item name="severity" label="严重级别" initialValue="critical">
            <Select options={SEVERITY_OPTIONS} />
          </Form.Item>
          <Form.Item name="location" label="发生位置">
            <Input placeholder="如：家中卫生间" />
          </Form.Item>
          <Form.Item name="description" label="情况描述">
            <Input.TextArea rows={2} placeholder="设备告警内容或管家初步观察" />
          </Form.Item>
          <Form.Item name="initiatedBy" label="触发人">
            <Input placeholder="管家值班台" />
          </Form.Item>
          <Form.Item label="演示：第一位联系人的模拟结果">
            <Select
              value={simulate}
              onChange={setSimulate}
              options={[
                {
                  value: "no_answer",
                  label: "未接听 → 自动转接 P2（推荐演示）",
                },
                { value: "answered", label: "直接接通 P1" },
                { value: "rejected", label: "拒接 → 自动转接 P2" },
                { value: "failed", label: "呼叫失败 → 自动转接 P2" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <ResolveModal
        detail={resolveTarget}
        onClose={() => setResolveTarget(null)}
        onResolved={() => {
          setResolveTarget(null);
          load();
        }}
      />
    </div>
  );
}
