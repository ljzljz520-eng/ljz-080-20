import { useCallback, useEffect, useState } from 'react';
import {
  App as AntApp,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
} from 'antd';
import {
  CONTACT_TYPE_META,
} from '../../api/types';
import type {
  Contact,
  ContactType,
  Elder,
  FamilyBinding,
} from '../../api/types';
import { api } from '../../api/client';
import { IconArrowDown, IconArrowUp, IconPhone } from './Icons';

interface Props {
  elder: Elder | null;
  open: boolean;
  onClose: () => void;
  changed: () => void;
}

const TYPE_OPTIONS = (
  Object.keys(CONTACT_TYPE_META) as ContactType[]
).map((t) => ({ value: t, label: `${CONTACT_TYPE_META[t].icon} ${CONTACT_TYPE_META[t].label}` }));

interface FormValues {
  name: string;
  relation: string;
  type: ContactType;
  phone: string;
  priority: number;
}

export default function ContactsDrawer({ elder, open, onClose, changed }: Props) {
  const { message } = AntApp.useApp();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [bindings, setBindings] = useState<FamilyBinding[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const load = useCallback(async () => {
    if (!elder) return;
    setLoading(true);
    try {
      const [list, binds] = await Promise.all([
        api.listContacts(elder.id),
        api.familyBindings(elder.id),
      ]);
      setContacts(list);
      setBindings(binds);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [elder, message]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'family',
      priority: contacts.length + 1,
      relation: '',
    });
    setFormOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditing(c);
    form.setFieldsValue({
      name: c.name,
      relation: c.relation,
      type: c.type,
      phone: c.phone,
      priority: c.priority,
    });
    setFormOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    if (!elder) return;
    try {
      if (editing) {
        await api.updateContact(elder.id, editing.id, values);
        message.success('联系人已更新');
      } else {
        await api.addContact(elder.id, values);
        message.success('联系人已添加，已按优先级插入呼叫队列');
      }
      setFormOpen(false);
      changed();
      void load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const move = async (c: Contact, delta: -1 | 1) => {
    if (!elder) return;
    const ordered = [...contacts].sort((a, b) => a.priority - b.priority);
    const idx = ordered.findIndex((x) => x.id === c.id);
    const target = idx + delta;
    if (target < 0 || target >= ordered.length) return;
    [ordered[idx], ordered[target]] = [ordered[target], ordered[idx]];
    try {
      const next = await api.reorderContacts(
        elder.id,
        ordered.map((x) => x.id),
      );
      setContacts(next);
      changed();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const toggle = async (c: Contact) => {
    if (!elder) return;
    try {
      await api.toggleContact(elder.id, c.id, !c.enabled);
      void load();
      changed();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const remove = async (c: Contact) => {
    if (!elder) return;
    try {
      await api.deleteContact(elder.id, c.id);
      message.success('已删除');
      void load();
      changed();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/h5?token=${token}`;
    void navigator.clipboard?.writeText(url);
    message.success('家属端链接已复制');
  };

  return (
    <Drawer
      title={
        elder ? (
          <span>
            {elder.name} 的紧急联系人
            <span className="soft-muted" style={{ marginLeft: 10, fontSize: 13 }}>
              {elder.room} · 突发事件按下方顺序分级呼叫
            </span>
          </span>
        ) : (
          ''
        )
      }
      width={620}
      open={open}
      onClose={onClose}
      extra={
        <Button type="primary" onClick={openAdd}>
          + 添加联系人
        </Button>
      }
    >
      <Empty
        style={{ display: loading ? 'none' : undefined }}
        description={
          contacts.length === 0 ? (
            <span>
              还没有紧急联系人。请至少添加一位家属，系统才能在突发事件时分级呼叫。
            </span>
          ) : undefined
        }
      >
        <div className="contact-list">
          {contacts.map((c) => {
            const meta = CONTACT_TYPE_META[c.type];
            const order = [...contacts]
              .sort((a, b) => a.priority - b.priority)
              .findIndex((x) => x.id === c.id);
            const isFirst = order === 0;
            const isLast = order === contacts.length - 1;
            const bind = bindings.find((b) => b.contactId === c.id);
            return (
              <div className="contact-row" key={c.id}>
                <Tooltip title="呼叫优先级，数字越小越先拨打">
                  <span className="priority-chip">L{c.priority}</span>
                </Tooltip>
                <div className="contact-main">
                  <div className="contact-name">
                    {meta.icon} {c.name}
                    <Tag color={meta.color} style={{ marginInlineStart: 0 }}>
                      {meta.label}
                    </Tag>
                    {!c.enabled && <Tag>已停用</Tag>}
                  </div>
                  <div className="contact-sub">
                    {c.relation ? `${c.relation} · ` : ''}
                    <IconPhone width={12} height={12} /> {c.phone}
                  </div>
                  {bind && (
                    <div className="family-link-box">
                      家属 H5 入口：
                      <a onClick={() => copyLink(bind.token)}>
                        {window.location.origin}/h5?token={bind.token}
                      </a>
                      <span className="soft-muted">（点击复制，仅可见本人相关报告）</span>
                    </div>
                  )}
                </div>
                <Space direction="vertical" size={4}>
                  <Space size={2}>
                    <Button
                      size="small"
                      disabled={isFirst}
                      icon={<IconArrowUp width={13} height={13} />}
                      onClick={() => move(c, -1)}
                    />
                    <Button
                      size="small"
                      disabled={isLast}
                      icon={<IconArrowDown width={13} height={13} />}
                      onClick={() => move(c, 1)}
                    />
                  </Space>
                  <Space size={4}>
                    <Switch
                      size="small"
                      checked={c.enabled}
                      checkedChildren="启用"
                      unCheckedChildren="停用"
                      onChange={() => void toggle(c)}
                    />
                    <Button size="small" onClick={() => openEdit(c)}>
                      编辑
                    </Button>
                    <Popconfirm
                      title="删除该联系人？"
                      onConfirm={() => void remove(c)}
                    >
                      <Button size="small" danger>
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                </Space>
              </div>
            );
          })}
        </div>
      </Empty>

      <Modal
        title={editing ? '编辑联系人' : '添加紧急联系人'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={() => void submit()}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="type"
            label="身份类别"
            rules={[{ required: true, message: '请选择类别' }]}
          >
            <Select options={TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请填写姓名' }]}
          >
            <Input placeholder="如：李建国" maxLength={20} />
          </Form.Item>
          <Form.Item name="relation" label="与老人关系 / 机构">
            <Input placeholder="如：长子 / 社区卫生服务中心 / 对门邻居" maxLength={30} />
          </Form.Item>
          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { required: true, message: '请填写手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的 11 位手机号' },
            ]}
          >
            <Input placeholder="11 位手机号" maxLength={11} />
          </Form.Item>
          <Form.Item
            name="priority"
            label="呼叫优先级（1 最先；若该级别已有人，其他人会自动后移）"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} max={99} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  );
}
