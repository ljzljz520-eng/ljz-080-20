import { useCallback, useEffect, useState } from 'react';
import {
  App as AntApp,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Tag,
} from 'antd';
import type { Elder } from '../../api/types';
import { api } from '../../api/client';
import ContactsDrawer from './ContactsDrawer';
import { IconPhone } from './Icons';

export default function EldersPage() {
  const { message } = AntApp.useApp();
  const [elders, setElders] = useState<Elder[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Elder | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setElders(await api.listElders());
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  const openContacts = (elder: Elder) => {
    setActive(elder);
    setDrawerOpen(true);
  };

  const createElder = async () => {
    const values = await form.validateFields();
    try {
      const elder = await api.createElder(values);
      message.success('老人档案已创建');
      setAddOpen(false);
      form.resetFields();
      void load();
      setActive(elder);
      setDrawerOpen(true);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <div style={{ flex: 1 }}>
          <h2 className="page-title">老人与紧急联系人</h2>
          <div className="page-sub">
            为每位老人设置家属、邻里、社区医生、物业的呼叫优先级；突发事件时系统按级别自动依次联系。
          </div>
        </div>
        <Button type="primary" size="large" onClick={() => setAddOpen(true)}>
          + 新建老人档案
        </Button>
      </div>

      <div className="elder-grid">
        {elders.map((e) => (
          <Card key={e.id} loading={loading} className="elder-card" styles={{ body: { padding: 18 } }}>
            <div className="elder-head">
              <div
                className="avatar"
                style={{
                  background:
                    e.gender === 'female'
                      ? 'linear-gradient(135deg,#e88a9c,#c96a7e)'
                      : 'linear-gradient(135deg,#6f9fd8,#3d7ec9)',
                }}
              >
                {e.name.slice(0, 1)}
              </div>
              <div>
                <div className="elder-name">
                  {e.name}
                  <span className="soft-muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                    {e.age} 岁 · {e.gender === 'female' ? '女' : '男'}
                  </span>
                </div>
                <div className="elder-meta">{e.room} · {e.address || '地址待完善'}</div>
              </div>
            </div>
            <div className="elder-foot">
              <span className="soft-muted">
                <IconPhone width={13} height={13} /> {e.phone}
              </span>
              <span>
                <Tag color={e.contactCount ? 'green' : 'red'}>
                  {e.contactCount ? `${e.contactCount} 位联系人` : '未设置联系人'}
                </Tag>
                <Button type="link" size="small" onClick={() => openContacts(e)}>
                  管理分级 →
                </Button>
              </span>
            </div>
          </Card>
        ))}
      </div>

      <ContactsDrawer
        elder={active}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        changed={() => void load()}
      />

      <Modal
        title="新建老人档案"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={() => void createElder()}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ gender: 'female', age: 75 }} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请填写姓名' }]}>
            <Input placeholder="老人姓名" maxLength={20} />
          </Form.Item>
          <Form.Item name="gender" label="性别" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="female">女</Radio>
              <Radio value="male">男</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="age" label="年龄" rules={[{ required: true }]}>
            <InputNumber min={1} max={120} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="room" label="楼栋房号">
            <Input placeholder="如 3-2-501" maxLength={30} />
          </Form.Item>
          <Form.Item name="address" label="详细地址">
            <Input placeholder="如 幸福里社区 3 栋 2 单元 501" maxLength={60} />
          </Form.Item>
          <Form.Item
            name="phone"
            label="老人本人/随身电话"
            rules={[
              { required: true, message: '请填写手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的 11 位手机号' },
            ]}
          >
            <Input maxLength={11} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
