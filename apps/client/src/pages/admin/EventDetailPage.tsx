import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  App as AntApp,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Result,
  Space,
  Tag,
} from 'antd';
import {
  CONTACT_TYPE_META,
  EVENT_STATUS_META,
  EVENT_TYPE_META,
} from '../../api/types';
import type { Attempt, EventDetail, StaffReport } from '../../api/types';
import { api } from '../../api/client';
import { formatFull, formatTime } from './format';
import { IconPhone } from './Icons';

export default function EventDetailPage() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [report, setReport] = useState<StaffReport | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.getEvent(eventId);
      setDetail(d);
      if (d.event.status === 'resolved') {
        setReport(await api.staffReport(eventId));
      }
    } catch (e) {
      message.error((e as Error).message);
    }
  }, [eventId, message]);

  useEffect(() => {
    void load();
    // 呼叫过程中每 1.5s 刷新时间线
    const tick = () => {
      void load();
      timerRef.current = window.setTimeout(tick, 1500);
    };
    timerRef.current = window.setTimeout(tick, 1500);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [load]);

  const settle = async (attemptId: string, outcome: string) => {
    setBusy(true);
    try {
      await api.settleCall(eventId, attemptId, {
        outcome,
        ...(outcome === 'answered' ? { talkSeconds: undefined } : {}),
      });
      message.success(
        outcome === 'answered'
          ? '已标记接通，系统将停止继续呼叫'
          : '已记录，系统自动转拨下一位联系人',
      );
      await load();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startCascade = async () => {
    setBusy(true);
    try {
      await api.startCascade(eventId);
      message.info('已开始 / 重新开始分级呼叫');
      await load();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resolve = async () => {
    const values = await form.validateFields();
    try {
      await api.resolveEvent(eventId, values.resolution);
      message.success('事件已关闭，处置报告已生成');
      setResolveOpen(false);
      await load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  if (!detail) return null;
  const { event, elder, attempts, ringingAttemptId, answeredContact } = detail;
  const typeMeta = EVENT_TYPE_META[event.type];
  const statusMeta = EVENT_STATUS_META[event.status];
  const live = event.status === 'calling' || event.status === 'pending';
  const ringing = attempts.find((a) => a.id === ringingAttemptId) ?? null;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div className="toolbar">
        <Button onClick={() => navigate('/admin/events')}>← 返回列表</Button>
        <h2 className="page-title" style={{ flex: 1 }}>
          <Tag color={typeMeta.color} style={{ fontSize: 14, padding: '2px 12px' }}>
            {typeMeta.label}
          </Tag>
          事件 {event.id.slice(-6).toUpperCase()}
        </h2>
        <span className="status-tag" style={{ color: statusMeta.color, background: statusMeta.bg, fontSize: 13 }}>
          {live && <span className="pulse-dot" />}
          {statusMeta.label}
        </span>
      </div>

      <Card className="card" style={{ marginBottom: 16 }}>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="老人">
            {elder ? `${elder.name}（${elder.gender === 'female' ? '女' : '男'} · ${elder.age}岁）` : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="住址">{elder?.address ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="老人电话">
            <IconPhone width={13} height={13} /> {elder?.phone ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="触发时间">{formatFull(event.triggeredAt)}</Descriptions.Item>
          <Descriptions.Item label="开始呼叫">{formatFull(event.cascadeStartedAt)}</Descriptions.Item>
          <Descriptions.Item label="关闭时间">{formatFull(event.closedAt)}</Descriptions.Item>
          <Descriptions.Item label="情况描述" span={3}>
            {event.description || '（无）'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        className="card"
        style={{ marginBottom: 16 }}
        title="📞 分级呼叫时间线（按优先级自动依次外呼，未接自动转下一位）"
        extra={
          <Space>
            {(event.status === 'pending' || event.status === 'failed') && (
              <Button type="primary" danger loading={busy} onClick={() => void startCascade()}>
                {event.status === 'failed' ? '重新发起呼叫' : '开始分级呼叫'}
              </Button>
            )}
            {(event.status === 'answered' || event.status === 'calling') && (
              <Button type="primary" onClick={() => setResolveOpen(true)}>
                现场处置完成，关闭并生成报告
              </Button>
            )}
          </Space>
        }
      >
        {attempts.length === 0 ? (
          <Result
            icon={<span style={{ fontSize: 40 }}>⏳</span>}
            title="尚未开始呼叫"
            subTitle="点击右上角「开始分级呼叫」，系统将从最高优先级联系人开始自动外呼。"
          />
        ) : (
          <CascadeTimeline
            attempts={attempts}
            ringingAttemptId={ringingAttemptId}
          />
        )}

        {ringing && (
          <div className="ring-box">
            <div className="ring-title">
              <span className="pulse-dot" />
              正在振铃：第 {ringing.sequence} 级 · {ringing.contact?.name}（
              {ringing.contact ? CONTACT_TYPE_META[ringing.contact.type].label : ''}
              {ringing.contact?.relation ? ` · ${ringing.contact.relation}` : ''}）
            </div>
            <div className="soft-muted" style={{ fontSize: 13, marginBottom: 10 }}>
              电话 {ringing.contact?.phone}。若振铃超时无人接听，系统会自动转拨下一位，
              也可以根据实际通话情况提前标记：
            </div>
            <div className="ring-actions">
              <Button
                type="primary"
                style={{ background: '#1f8a5b', borderColor: '#1f8a5b' }}
                loading={busy}
                onClick={() => void settle(ringing.id, 'answered')}
              >
                ✓ 对方已接通
              </Button>
              <Button loading={busy} onClick={() => void settle(ringing.id, 'no_answer')}>
                无人接听，立即转下一位
              </Button>
              <Button loading={busy} onClick={() => void settle(ringing.id, 'rejected')}>
                对方挂断
              </Button>
              <Button loading={busy} onClick={() => void settle(ringing.id, 'offline')}>
                无法接通（关机/占线）
              </Button>
            </div>
          </div>
        )}

        {event.status === 'failed' && (
          <Result
            status="error"
            title="全部联系人未接通"
            subTitle="系统已按优先级呼叫完所有启用联系人，均未接听。请立即启动线下兜底（上门查看 / 联动 120 / 物业破门），处理后可重新呼叫并关闭事件。"
          />
        )}
        {event.status === 'answered' && answeredContact && (
          <Result
            status="success"
            title={`已由「${answeredContact.name}」（${CONTACT_TYPE_META[answeredContact.type].label}${answeredContact.relation ? ` · ${answeredContact.relation}` : ''}）接通`}
            subTitle="系统已停止继续呼叫，请等待联系人到场或上门处置，完成后关闭事件并生成报告。"
          />
        )}
      </Card>

      {report && (
        <Card className="card" title="📋 事件处置报告（工作人员完整版）">
          <div className="report-box">
            <strong>处置摘要</strong>
            {'\n'}
            {report.summary}
            {'\n\n'}
            <strong>呼叫明细（共 {report.totalCalls} 通，{report.answeredCalls} 通接通）</strong>
            {'\n'}
            {report.lines.map((l) => (
              <div key={l.sequence}>
                L{l.sequence} {l.contactName}（{l.contactType}
                {l.relation ? `·${l.relation}` : ''}）：{l.outcome}
                {l.talkSeconds ? `，通话 ${l.talkSeconds} 秒` : ''}
                {'  '}
                <span className="soft-muted">{formatTime(l.startedAt)}</span>
              </div>
            ))}
            {'\n'}
            <strong>现场处置小结</strong>
            {'\n'}
            {report.resolution}
            {'\n\n'}
            <span className="soft-muted">
              家属端仅能看到与自己相关的呼叫记录和「老人是否已获帮助」，看不到其他联系人信息。
            </span>
          </div>
        </Card>
      )}

      <Modal
        title="关闭事件并生成处置报告"
        open={resolveOpen}
        onCancel={() => setResolveOpen(false)}
        onOk={() => void resolve()}
        okText="确认关闭并生成报告"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="resolution"
            label="处置小结（将写入报告）"
            rules={[{ required: true, message: '请填写处置小结' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="如：管家 18:32 到场，老人无外伤，情绪稳定；家属已接回家中观察，次日陪同就医复查。"
              maxLength={300}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function CascadeTimeline({
  attempts,
  ringingAttemptId,
}: {
  attempts: Attempt[];
  ringingAttemptId: string | null;
}) {
  return (
    <div className="cascade-timeline">
      {attempts.map((a) => {
        const meta = a.contact ? CONTACT_TYPE_META[a.contact.type] : null;
        const isRinging = a.id === ringingAttemptId;
        const isAnswered = a.outcome === 'answered';
        const isFail = !isRinging && a.outcome !== 'answered' && a.outcome !== 'pending';
        return (
          <div
            key={a.id}
            className={`cascade-item${isAnswered ? ' is-answered' : ''}${isFail ? ' is-fail' : ''}${isRinging ? ' is-ringing' : ''}`}
          >
            <div className="level-dot">
              {isAnswered ? '✓' : isRinging ? <span className="pulse-dot" /> : a.sequence}
            </div>
            <div className="cascade-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <strong>
                    {meta?.icon} {a.contact?.name ?? '联系人已删除'}
                  </strong>{' '}
                  {meta && <Tag color={meta.color}>{meta.label}</Tag>}
                  {a.contact?.relation && (
                    <span className="soft-muted" style={{ fontSize: 13 }}>
                      {a.contact.relation}
                    </span>
                  )}
                </div>
                <span className="soft-muted" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                  {formatTime(a.startedAt)}
                </span>
              </div>
              <div style={{ marginTop: 4, fontSize: 13.5 }}>
                <IconPhone width={12} height={12} /> {a.contact?.phone ?? '—'}
                {'　'}
                <OutcomeText outcome={a.outcome} />
                {a.talkSeconds ? ` · 通话 ${a.talkSeconds} 秒` : ''}
              </div>
              {a.note && <div className="soft-muted" style={{ fontSize: 12.5, marginTop: 2 }}>{a.note}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OutcomeText({ outcome }: { outcome: Attempt['outcome'] }) {
  const map: Record<Attempt['outcome'], { text: string; color: string }> = {
    pending: { text: '振铃中…', color: '#c0392b' },
    answered: { text: '已接通', color: '#1f8a5b' },
    no_answer: { text: '无人接听（已自动转下一位）', color: '#9a6b1e' },
    rejected: { text: '挂断（已自动转下一位）', color: '#b05050' },
    offline: { text: '无法接通（已自动转下一位）', color: '#7a8290' },
  };
  const m = map[outcome];
  return <strong style={{ color: m.color }}>{m.text}</strong>;
}
