import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  App as AntApp,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EVENT_STATUS_META,
  EVENT_TYPE_META,
} from '../../api/types';
import type { Elder, EventItem, EventType } from '../../api/types';
import { api } from '../../api/client';
import { formatTime } from './format';

const EVENT_OPTIONS: { value: EventType; label: string }[] = [
  { value: 'fall', label: '跌倒' },
  { value: 'illness', label: '突发疾病' },
  { value: 'fire', label: '火情' },
  { value: 'intruder', label: '非法闯入' },
  { value: 'other', label: '其他紧急情况' },
];

export default function EventsPage() {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [elders, setElders] = useState<Elder[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const elderMap = useMemo(
    () => new Map(elders.map((e) => [e.id, e])),
    [elders],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [evs, es] = await Promise.all([api.listEvents(), api.listElders()]);
      setEvents(evs);
      setElders(es);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [message]);

  // 呼叫中 / 待受理事件自动刷新，便于管家看到实时级联进展
  useEffect(() => {
    const hasLive = events.some((e) => e.status === 'calling' || e.status === 'pending');
    if (!hasLive) return;
    const t = setInterval(() => void load(), 2000);
    return () => clearInterval(t);
  }, [events, load]);

  useEffect(() => {
    void load();
  }, [load]);

  const trigger = async () => {
    const values = await form.validateFields();
    try {
      const ev = await api.triggerEvent(values);
      message.warning('突发事件已创建，正在进入分级呼叫');
      setModalOpen(false);
      form.resetFields();
      // 自动发起级联，无需管家翻通讯录
      await api.startCascade(ev.id);
      navigate(`/admin/events/${ev.id}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const stats = useMemo(() => {
    const live = events.filter((e) => e.status === 'calling').length;
    const answered = events.filter((e) => e.status === 'answered').length;
    const resolved = events.filter((e) => e.status === 'resolved').length;
    const failed = events.filter((e) => e.status === 'failed').length;
    return { live, answered, resolved, failed };
  }, [events]);

  const columns: ColumnsType<EventItem> = [
    {
      title: '事件',
      dataIndex: 'type',
      render: (_, r) => {
        const meta = EVENT_TYPE_META[r.type];
        return (
          <Space>
            <Tag color={meta.color} style={{ fontWeight: 600 }}>
              {meta.label}
            </Tag>
            <span>{r.description || '（无补充描述）'}</span>
          </Space>
        );
      },
    },
    {
      title: '老人',
      width: 160,
      render: (_, r) => {
        const e = elderMap.get(r.elderId);
        return e ? `${e.name}（${e.room}）` : r.elderId;
      },
    },
    {
      title: '触发时间',
      dataIndex: 'triggeredAt',
      width: 150,
      render: (v: string) => formatTime(v),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 130,
      render: (v: EventItem['status']) => {
        const m = EVENT_STATUS_META[v];
        return (
          <span className="status-tag" style={{ color: m.color, background: m.bg }}>
            {v === 'calling' && <span className="pulse-dot" />}
            {m.label}
          </span>
        );
      },
    },
    {
      title: '操作',
      width: 120,
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => navigate(`/admin/events/${r.id}`)}>
          {r.status === 'resolved' ? '查看报告' : '处置详情 →'}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="toolbar">
        <div style={{ flex: 1 }}>
          <h2 className="page-title">突发事件</h2>
          <div className="page-sub">
            事件触发后系统按联系人优先级自动逐级外呼；未接听自动转下一位，管家只需在当前通话上标记结果。
          </div>
        </div>
        <Button
          type="primary"
          danger
          size="large"
          onClick={() => setModalOpen(true)}
        >
          🚨 上报突发事件
        </Button>
      </div>

      <div className="stat-row">
        <Card className="card stat-card">
          <div className="stat-num" style={{ color: '#c0392b' }}>{stats.live}</div>
          <div className="stat-label">正在分级呼叫</div>
        </Card>
        <Card className="card stat-card">
          <div className="stat-num" style={{ color: '#1f8a5b' }}>{stats.answered}</div>
          <div className="stat-label">已接通待处置</div>
        </Card>
        <Card className="card stat-card">
          <div className="stat-num" style={{ color: '#3d7ec9' }}>{stats.resolved}</div>
          <div className="stat-label">已处置归档</div>
        </Card>
        <Card className="card stat-card">
          <div className="stat-num" style={{ color: '#b03030' }}>{stats.failed}</div>
          <div className="stat-label">全部未接（需兜底）</div>
        </Card>
      </div>

      <Card className="card" styles={{ body: { padding: 8 } }}>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={events}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          onRow={(r) => ({
            onClick: () => navigate(`/admin/events/${r.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      <Modal
        title="🚨 上报突发事件"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void trigger()}
        okText="立即触发并分级呼叫"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="elderId"
            label="发生老人"
            rules={[{ required: true, message: '请选择老人' }]}
          >
            <Select
              placeholder="选择老人"
              options={elders.map((e) => ({
                value: e.id,
                label: `${e.name}（${e.room}）`,
              }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            name="type"
            label="事件类型"
            rules={[{ required: true, message: '请选择事件类型' }]}
          >
            <Select options={EVENT_OPTIONS} placeholder="选择事件类型" />
          </Form.Item>
          <Form.Item name="description" label="情况描述">
            <Input.TextArea
              rows={3}
              placeholder="如：卫生间滑倒，意识清醒，右腿不敢动"
              maxLength={200}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
