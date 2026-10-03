import { useState } from "react";
import { App as AntApp, Input, Modal } from "antd";
import { api } from "../../api/client";
import type { EventDetail } from "../../api/types";

interface Props {
  detail: EventDetail | null;
  onClose: () => void;
  onResolved: () => void;
}

export default function ResolveModal({ detail, onClose, onResolved }: Props) {
  const { message } = AntApp.useApp();
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!detail || !resolution.trim()) {
      message.warning("请填写现场处置结果");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/api/admin/events/${detail.event.id}/resolve`, {
        resolution,
      });
      message.success("已结案，处置报告已生成并同步给相关家属");
      onResolved();
      setResolution("");
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="🤝 事件结案"
      open={!!detail}
      onCancel={onClose}
      onOk={submit}
      confirmLoading={saving}
      okText="确认结案并生成报告"
      cancelText="取消"
    >
      <p style={{ color: "#6b7280", fontSize: 13 }}>
        结案后系统自动生成简短处置报告，家属在 H5
        端只能看到与自己相关的呼叫结果和处置摘要。
      </p>
      <Input.TextArea
        rows={4}
        placeholder="请填写现场处置结果，如：已上门查看，老人为误报，生命体征平稳……"
        value={resolution}
        onChange={(e) => setResolution(e.target.value)}
      />
    </Modal>
  );
}
