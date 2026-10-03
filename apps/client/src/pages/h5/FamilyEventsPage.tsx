import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Empty, PullToRefresh } from 'antd-mobile';
import { api } from '../../api/client';
import type { FamilyEventListItem, FamilyMe } from '../../api/types';
import { formatTime } from '../admin/format';

function statusColor(s: FamilyEventListItem['rawStatus']): {
  color: string;
  bg: string;
  text: string;
} {
  switch (s) {
    case 'calling':
      return { color: '#c0392b', bg: '#fdecea', text: '系统正在呼叫中' };
    case 'answered':
      return { color: '#1f8a5b', bg: '#e6f6ee', text: '已有联系人接通' };
    case 'resolved':
      return { color: '#3d7ec9', bg: '#e8f1fc', text: '已处置完成' };
    case 'failed':
      return { color: '#b03030', bg: '#fde8e8', text: '暂未联系上，社区处理中' };
    default:
      return { color: '#b07d12', bg: '#fff6e0', text: '待受理' };
  }
}

export default function FamilyEventsPage({
  token,
  me,
}: {
  token: string;
  me: FamilyMe;
}) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<FamilyEventListItem[] | null>(null);

  const load = useCallback(async () => {
    setEvents(await api.familyEvents(token));
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const hasLive = events?.some(
    (e) => e.rawStatus === 'calling' || e.rawStatus === 'pending',
  );
  useEffect(() => {
    if (!hasLive) return;
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
    // 轮询是有意的外部订阅行为，无需同步 setState
  }, [hasLive, load]);

  return (
    <div className="h5-shell">
      <div className="h5-header">
        <div className="h5-title">🤲 家属应急通道</div>
        <div className="h5-sub">
          {me.name}（{me.relation || '家属'}）您好，这里是 {me.elderName} 的突发事件同步。
          {me.elderAddress ? `常住地址：${me.elderAddress}` : ''}
        </div>
      </div>

      <div className="h5-body">
        <div className="section-label">📢 与我相关的事件</div>
        <PullToRefresh onRefresh={async () => void load()}>
          {events === null ? (
            <div className="h5-card soft-muted" style={{ textAlign: 'center' }}>
              加载中…
            </div>
          ) : events.length === 0 ? (
            <div className="h5-card">
              <Empty
                description="目前没有突发事件，一切平安"
                style={{ '--image-width': '90px' } as CSSProperties}
              />
            </div>
          ) : (
            events.map((e) => {
              const st = statusColor(e.rawStatus);
              const my = e.myCall;
              return (
                <div
                  key={e.id}
                  className="h5-card event-card"
                  onClick={() => navigate(`/h5/events/${e.id}`)}
                >
                  <div className="ev-top">
                    <span className="ev-type">🚨 {e.type}</span>
                    <span
                      className="status-tag"
                      style={{ color: st.color, background: st.bg }}
                    >
                      {e.rawStatus === 'calling' && <span className="pulse-dot" />}
                      {st.text}
                    </span>
                  </div>
                  {e.description && <div className="ev-desc">{e.description}</div>}
                  <div className="ev-foot">
                    <span>{formatTime(e.triggeredAt)}</span>
                    {my && (
                      <span
                        className={`my-call-pill ${
                          my.outcome === 'answered'
                            ? 'answered'
                            : my.outcome === 'pending'
                              ? 'ring'
                              : 'miss'
                        }`}
                      >
                        {my.outcome === 'pending' && <span className="pulse-dot" />}
                        第 {my.sequence} 级呼叫 · {my.outcomeLabel}
                      </span>
                    )}
                    <span>查看报告 →</span>
                  </div>
                </div>
              );
            })
          )}
        </PullToRefresh>

        <div className="privacy-note" style={{ marginTop: 18 }}>
          🔒 隐私说明：您只能看到本次事件中<strong>与您本人相关</strong>的呼叫记录和老人是否已获得帮助，
          其他家属、邻里、医生和物业的联系方式与处置细节不会对您展示。
        </div>
      </div>
    </div>
  );
}
