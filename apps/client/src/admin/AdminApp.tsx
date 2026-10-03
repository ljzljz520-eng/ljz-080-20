import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { useMemo, useState } from "react";
import type { Elder } from "../api/types";
import DashboardPage from "./pages/DashboardPage";
import ContactsPage from "./pages/ContactsPage";
import ReportsPage from "./pages/ReportsPage";
import "./admin.less";

type TabKey = "dashboard" | "contacts" | "reports";

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "dashboard", label: "应急指挥台", icon: "🚨" },
  { key: "contacts", label: "分级联系人", icon: "📋" },
  { key: "reports", label: "处置报告", icon: "📄" },
];

export default function AdminApp() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [elder, setElder] = useState<Elder | undefined>(undefined);
  const [refreshTick, setRefreshTick] = useState(0);

  const content = useMemo(() => {
    if (tab === "contacts") {
      return (
        <ContactsPage
          elder={elder}
          onElderChange={setElder}
          refreshTick={refreshTick}
          bump={() => setRefreshTick((n) => n + 1)}
        />
      );
    }
    if (tab === "reports") {
      return <ReportsPage elder={elder} onElderChange={setElder} />;
    }
    return (
      <DashboardPage
        elder={elder}
        onElderChange={setElder}
        bump={() => setRefreshTick((n) => n + 1)}
      />
    );
  }, [tab, elder, refreshTick]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 10,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
        },
      }}
    >
      <div className="admin-layout">
        <aside className="admin-sider">
          <div className="brand">
            <span className="brand-logo">🛡️</span>
            <div>
              <div className="brand-name">颐养应急平台</div>
              <div className="brand-sub">管家工作台 · PC</div>
            </div>
          </div>
          <nav className="nav-list">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`nav-item ${tab === t.key ? "active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                <span className="nav-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="sider-footer">
            <div className="staff-hint">
              管理端演示令牌：<code>demo-staff-token</code>
            </div>
          </div>
        </aside>
        <main className="admin-main">{content}</main>
      </div>
    </ConfigProvider>
  );
}
