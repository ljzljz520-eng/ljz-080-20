import { useEffect, useState } from "react";
import { Select } from "antd";
import { api } from "../api/client";
import type { Elder } from "../api/types";

interface Props {
  elder?: Elder;
  onChange: (elder: Elder | undefined) => void;
  allowAll?: boolean;
}

export default function ElderPicker({
  elder,
  onChange,
  allowAll = true,
}: Props) {
  const [elders, setElders] = useState<Elder[]>([]);

  useEffect(() => {
    api.get<Elder[]>("/api/admin/elders").then((list) => {
      setElders(list);
      if (!elder && list.length > 0) onChange(list[0]);
    });
  }, []);

  return (
    <Select
      style={{ width: 260 }}
      placeholder="选择老人"
      value={elder?.id}
      onChange={(id) => onChange(elders.find((e) => e.id === id))}
      options={[
        ...(allowAll ? [{ value: "", label: "全部老人" }] : []),
        ...elders.map((e) => ({
          value: e.id,
          label: `${e.name}${e.age ? `（${e.age} 岁）` : ""}`,
        })),
      ]}
    />
  );
}
