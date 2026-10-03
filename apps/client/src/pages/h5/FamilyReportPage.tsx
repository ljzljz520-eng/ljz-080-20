import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DotLoading, Result } from 'antd-mobile';
import { api } from '../../api/client';
import type { FamilyReport } from '../../api/types';
import { formatFull } from '../admin/format';

export default function FamilyReportPage({
  token,
  onBack,
}: {
  token: string;
  onBack: () => void;
}) {
  const { eventId = '' } = useParams();
  const [report, setReport] = useState<FamilyReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReport(await api.familyReport(token, eventId));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token, eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [load]);

  if (error) {
    return (
      <div className="h5-shell">
        <div className="h5-header">
          <div className="back-bar" onClick={onBack}>← 返回事件列表</div>
        </div>
        <div className="h5-body">
          <Result status="error" title="无法查看" description={error} />
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="h5-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <span style={{ color: '#999' }}>报告加载中 <DotLoading /></span>
      </div>
    );
  }

  return (
    <div className="h5-shell">
      <div className="h5-header">
        <div className="back-bar" onClick={onBack}>← 返回</div>
        <div className="h5-title">🚨 {report.eventType}事件 · 处置同步</div>
        <div className="h5-sub">
          {report.elderName} · 发生于 {formatFull(report.triggeredAt)}
        </div>
      </div>

      <div className="h5-body">
        {report.description && (
          <div className="h5-card">
            <div className="section-label" style={{ margin: 0 }}>情况描述</div>
            <div style={{ marginTop: 6, lineHeight: 1.7, fontSize: 14 }}>
              {report.description}
            </div>
          </div>
        )}

        <div className={`report-hero ${report.assisted ? 'ok' : 'wait'}`}>
          <div className="hero-label">老人目前情况</div>
          <div className="hero-main">
            {report.assisted ? '✓ 老人已获得帮助' : '社区正在紧急处理中'}
          </div>
          <div className="hero-sub">
            {report.assisted
              ? report.elderHelpedBy
                ? `本次已由${report.elderHelpedBy}接通并知悉情况，请放心。`
                : '事件已处置完成，请放心。'
              : '系统仍在按优先级联系应急联系人，请您保持电话畅通。'}
          </div>
        </div>

        <div className="section-label">📞 与我相关的呼叫记录</div>
        <div className="h5-card">
          {report.lines.length === 0 ? (
            <div className="soft-muted" style={{ fontSize: 13.5, lineHeight: 1.7 }}>
              本次事件在呼叫到您之前已由更高级别的联系人接通，未产生对您的呼叫。
            </div>
          ) : (
            report.lines.map((l) => (
              <div className="report-line" key={l.sequence} style={{ marginBottom: 14 }}>
                <div
                  className="rl-badge"
                  style={{
                    background: l.selfAnswered ? '#e6f6ee' : '#fff6e0',
                    color: l.selfAnswered ? '#1f8a5b' : '#b07d12',
                  }}
                >
                  L{l.sequence}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="rl-name">
                    {l.contactName}
                    <span className="soft-muted" style={{ fontWeight: 400, fontSize: 12.5, marginLeft: 8 }}>
                      {l.contactType}
                      {l.relation ? ` · ${l.relation}` : ''}
                    </span>
                  </div>
                  <div className="rl-sub">
                    拨打时间：{formatFull(l.startedAt)}
                    <br />
                    结果：
                    <strong
                      style={{
                        color: l.selfAnswered ? '#1f8a5b' : '#b07d12',
                      }}
                    >
                      {l.outcome}
                    </strong>
                    {l.talkSeconds ? ` · 通话 ${l.talkSeconds} 秒` : ''}
                  </div>
                  {l.note && <div className="rl-sub">备注：{l.note}</div>}
                </div>
              </div>
            ))
          )}
        </div>

        {report.resolutionRelevant && (
          <>
            <div className="section-label">📋 处置结果</div>
            <div className="h5-card">
              <div style={{ lineHeight: 1.8, fontSize: 14 }}>
                {report.resolutionRelevant}
              </div>
            </div>
          </>
        )}

        <div className="section-label">🪶 简短报告</div>
        <div className="h5-card">
          <div style={{ lineHeight: 1.85, fontSize: 14 }}>{report.summary}</div>
        </div>

        <div className="privacy-note">
          🔒 本报告仅包含与您相关的内容。为保护其他联系人隐私，其他人员的呼叫与处置信息不在此处展示。
        </div>
      </div>
    </div>
  );
}
