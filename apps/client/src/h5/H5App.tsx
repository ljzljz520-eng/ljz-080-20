import { useEffect, useState } from "react";
import { Button, Card, Empty, NavBar, Tag } from "antd-mobile";
import { api } from "../api/client";
import type { FamilyReportView } from "../api/types";

import ReportCard from "./ReportCard";
import "./h5.less";

interface Me {
  name: string;
  role: string;
  relation?: string;
}

export default function H5App() {
  const [token, setToken] = useState(
    localStorage.getItem("family_token") ?? "",
  );
  const [authed, setAuthed] = useState(!!localStorage.getItem("family_token"));
  const [me, setMe] = useState<Me | null>(null);
  const [reports, setReports] = useState<FamilyReportView[] | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    const [meRes, reportsRes] = await Promise.all([
      api.get<Me>("/api/family/me"),
      api.get<FamilyReportView[]>("/api/family/reports"),
    ]);
    setMe(meRes);
    setReports(reportsRes);
  };

  useEffect(() => {
    if (authed) {
      load().catch((err) => {
        setError(err.message);
        setAuthed(false);
      });
    }
  }, [authed]);

  const login = () => {
    const t = token.trim();
    if (!t) return;
    localStorage.setItem("family_token", t);
    setError("");
    setAuthed(true);
  };

  const logout = () => {
    localStorage.removeItem("family_token");
    setAuthed(false);
    setMe(null);
    setReports(null);
  };

  if (!authed) {
    return (
      <div className="h5-root">
        <div className="h5-login">
          <div className="h5-hero">
            <div className="h5-hero-icon">🛡️</div>
            <h1>颐养守护</h1>
            <p>家属处置报告 · H5</p>
          </div>
          <Card className="h5-login-card">
            <div className="field-label">家属访问令牌</div>
            <input
              className="h5-input"
              placeholder="请输入管家提供的访问令牌"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
            />
            {error && (
              <div className="h5-error">
                令牌无效或已失效，请联系管家重新获取
              </div>
            )}
            <Button
              block
              color="primary"
              size="large"
              onClick={login}
              style={{ marginTop: 16 }}
            >
              查看处置报告
            </Button>
            <div className="h5-login-tip">
              演示令牌：<code>family-demo-wangxm</code> /{" "}
              <code>family-demo-lina</code>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h5-root">
      <NavBar
        backArrow={false}
        right={
          <span className="h5-logout" onClick={logout}>
            退出
          </span>
        }
      >
        家属处置报告
      </NavBar>

      <div className="h5-banner">
        <div className="h5-banner-name">{me?.name}</div>
        <div className="h5-banner-sub">
          {me?.relation ? `${me.relation} · ` : ""}家属账号
        </div>
        <Tag color="primary" fill="outline">
          仅展示与您相关的呼叫信息
        </Tag>
      </div>

      <div className="h5-content">
        {!reports ? (
          <div className="h5-loading">加载中…</div>
        ) : reports.length === 0 ? (
          <Card>
            <Empty
              description="暂无已结案的突发事件处置报告"
              style={{ padding: "24px 0" }}
            />
          </Card>
        ) : (
          reports.map((v) => <ReportCard key={v.event.id} view={v} />)
        )}
      </div>

      <div className="h5-footer">颐养应急守护平台 · 紧急情况请同时拨打 120</div>
    </div>
  );
}
