import { useCallback, useEffect, useState } from "react";
import {
  App as AntApp,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { api } from "../../api/client";
import type { Contact, ContactRole, Elder } from "../../api/types";
import ElderPicker from "../ElderPicker";
import { ROLE_COLOR, ROLE_LABEL } from "../../common/format";
import "./contacts.less";

const { Text } = Typography;

interface Props {
  elder?: Elder;
  onElderChange: (e: Elder | undefined) => void;
  refreshTick: number;
  bump: () => void;
}

const ROLE_OPTIONS = (Object.keys(ROLE_LABEL) as ContactRole[]).map((r) => ({
  value: r,
  label: ROLE_LABEL[r],
}));

interface FormValues {
  name: string;
  role: ContactRole;
  phone: string;
  relation?: string;
  priority: number;
  note?: string;
}

export default function ContactsPage({
  elder,
  onElderChange,
  refreshTick,
  bump,
}: Props) {
  const { message } = AntApp.useApp();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const load = useCallback(async () => {
    if (!elder) return;
    setLoading(true);
    try {
      setContacts(
        await api.get<Contact[]>(`/api/admin/contacts?elderId=${elder.id}`),
      );
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [elder, message]);

  useEffect(() => {
    load();
  }, [load, refreshTick]);

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    form.setFieldsValue({
      role: "family",
      priority: contacts.length + 1,
    });
  };

  const openEdit = (c: Contact) => {
    setCreating(false);
    setEditing(c);
    form.setFieldsValue({
      name: c.name,
      role: c.role,
      phone: c.phone,
      relation: c.relation,
      priority: c.priority,
      note: c.note,
    });
  };

  const save = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.patch(`/api/admin/contacts/${editing.id}`, values);
        message.success("联系人已更新");
      } else {
        const created = await api.post<Contact>("/api/admin/contacts", {
          ...values,
          elderId: elder!.id,
          enabled: true,
        });
        if (created.role === "family" && created.accessToken) {
          Modal.info({
            title: "家属访问令牌已生成",
            width: 520,
            content: (
              <div>
                <p>
                  家属 <b>{created.name}</b> 可使用以下令牌登录 H5
                  端查看与其相关的处置报告，请通过安全渠道发送：
                </p>
                <Text copyable code style={{ fontSize: 14 }}>
                  {created.accessToken}
                </Text>
              </div>
            ),
          });
        }
        message.success("联系人已添加");
      }
      setCreating(false);
      setEditing(null);
      bump();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const toggleEnabled = async (c: Contact, enabled: boolean) => {
    await api.patch(`/api/admin/contacts/${c.id}`, { enabled });
    message.success(enabled ? "已启用" : "已停用，呼叫时将自动跳过");
    bump();
  };

  const remove = async (c: Contact) => {
    await api.delete(`/api/admin/contacts/${c.id}`);
    message.success("已删除");
    bump();
  };

  const move = async (c: Contact, delta: number) => {
    const sorted = [...contacts].sort((a, b) => a.priority - b.priority);
    const idx = sorted.findIndex((x) => x.id === c.id);
    const target = idx + delta;
    if (target < 0 || target >= sorted.length) return;
    [sorted[idx], sorted[target]] = [sorted[target], sorted[idx]];
    await api.put(`/api/admin/contacts/reorder/${elder!.id}`, {
      orderedIds: sorted.map((x) => x.id),
    });
    message.success("优先级已调整");
    bump();
  };

  const rotateToken = async (c: Contact) => {
    const res = await api.post<{ id: string; accessToken: string }>(
      `/api/admin/contacts/${c.id}/rotate-token`,
    );
    Modal.info({
      title: "已重新签发家属访问令牌（旧令牌立即失效）",
      content: (
        <Text copyable code style={{ fontSize: 14 }}>
          {res.accessToken}
        </Text>
      ),
    });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="title-block">
          <h1>📋 分级联系人配置</h1>
          <p>
            按优先级（P1
            最先）配置家属、邻里、社区医生、物业；事件触发后系统依序自动呼叫
          </p>
        </div>
        <div className="elder-picker-row">
          <ElderPicker
            elder={elder}
            onChange={onElderChange}
            allowAll={false}
          />
          <Button type="primary" onClick={openCreate} disabled={!elder}>
            ＋ 添加联系人
          </Button>
        </div>
      </div>

      <div className="card">
        <Table<Contact>
          rowKey="id"
          loading={loading}
          dataSource={contacts}
          pagination={false}
          size="middle"
          columns={[
            {
              title: "优先级",
              dataIndex: "priority",
              width: 130,
              sorter: (a, b) => a.priority - b.priority,
              defaultSortOrder: "ascend",
              render: (_, c) => (
                <span className="priority-control">
                  <span className="priority-badge">P{c.priority}</span>
                  <span className="priority-arrows">
                    <Button
                      size="small"
                      type="text"
                      disabled={c.priority === 1}
                      onClick={() => move(c, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      size="small"
                      type="text"
                      disabled={c.priority === contacts.length}
                      onClick={() => move(c, 1)}
                    >
                      ↓
                    </Button>
                  </span>
                </span>
              ),
            },
            {
              title: "身份",
              dataIndex: "role",
              width: 110,
              render: (role: ContactRole) => (
                <Tag color={ROLE_COLOR[role]} style={{ marginRight: 0 }}>
                  {ROLE_LABEL[role]}
                </Tag>
              ),
            },
            {
              title: "姓名",
              dataIndex: "name",
              render: (name, c) => (
                <div>
                  <b>{name}</b>
                  {c.relation && (
                    <span className="relation-text">（{c.relation}）</span>
                  )}
                </div>
              ),
            },
            { title: "电话", dataIndex: "phone", width: 160 },
            {
              title: "备注",
              dataIndex: "note",
              width: 200,
              render: (note) => (
                <span className="note-text">{note ?? "—"}</span>
              ),
            },
            {
              title: "家属令牌",
              width: 130,
              render: (_, c) =>
                c.role === "family" ? (
                  <Tooltip title="家属 H5 登录凭证，遗失可重签">
                    <Button size="small" onClick={() => rotateToken(c)}>
                      签发/重置
                    </Button>
                  </Tooltip>
                ) : (
                  <span className="note-text">—</span>
                ),
            },
            {
              title: "启用",
              dataIndex: "enabled",
              width: 80,
              render: (enabled: boolean, c) => (
                <Switch
                  checked={enabled}
                  onChange={(v) => toggleEnabled(c, v)}
                />
              ),
            },
            {
              title: "操作",
              width: 130,
              render: (_, c) => (
                <span className="row-actions">
                  <Button size="small" type="link" onClick={() => openEdit(c)}>
                    编辑
                  </Button>
                  <Popconfirm
                    title="确认删除该联系人？"
                    onConfirm={() => remove(c)}
                  >
                    <Button size="small" type="link" danger>
                      删除
                    </Button>
                  </Popconfirm>
                </span>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={editing ? "编辑联系人" : "添加紧急联系人"}
        open={creating || !!editing}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
        }}
        onOk={save}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="role" label="身份类别" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: "请输入姓名" }]}
          >
            <Input placeholder="联系人姓名" />
          </Form.Item>
          <div className="form-row-2">
            <Form.Item
              name="phone"
              label="电话"
              rules={[{ required: true, message: "请输入电话" }]}
            >
              <Input placeholder="手机号 / 座机" />
            </Form.Item>
            <Form.Item
              name="priority"
              label="优先级（1 最先）"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} max={20} style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <Form.Item name="relation" label="与老人关系">
            <Input placeholder="如：长子 / 对门邻居 / 家庭医生" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input placeholder="如：持有备用钥匙、工作日开会较多" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
