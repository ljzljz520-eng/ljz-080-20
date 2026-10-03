import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { Button, DotLoading, ErrorBlock, Input, Toast } from 'antd-mobile';
import { api } from '../../api/client';
import type { FamilyMe } from '../../api/types';
import FamilyEventsPage from './FamilyEventsPage';
import FamilyReportPage from './FamilyReportPage';
import { getFamilyToken } from './token';

export default function FamilyApp() {
  const [token, setToken] = useState<string | null>(() => getFamilyToken());
  const [me, setMe] = useState<FamilyMe | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadMe = useCallback(async (tk: string) => {
    setLoading(true);
    try {
      setMe(await api.familyMe(tk));
    } catch {
      Toast.show({ icon: 'fail', content: '访问链接无效或已被停用' });
      localStorage.removeItem('family_token');
      setToken(null);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void loadMe(token);
    else setLoading(false);
  }, [token, loadMe]);

  if (!token) {
    return <TokenEntry onSaved={(tk) => setToken(tk)} />;
  }
  if (loading || !me) {
    return (
      <div className="h5-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <span style={{ color: '#999' }}>
          加载中 <DotLoading />
        </span>
      </div>
    );
  }

  return (
    <Routes>
      <Route index element={<FamilyEventsPage token={token} me={me} />} />
      <Route
        path="events/:eventId"
        element={
          <FamilyReportPage
            token={token}
            onBack={() => navigate('/h5')}
          />
        }
      />
    </Routes>
  );
}

function TokenEntry({ onSaved }: { onSaved: (token: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="h5-shell">
      <div className="token-entry">
        <div className="token-logo">🤲</div>
        <div className="token-title">家属应急通道</div>
        <div className="token-sub">
          这里向您同步家中老人的突发事件处置情况。
          <br />
          请输入管家提供的专属访问码（或直接点击管家分享给您的链接）。
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            placeholder="请输入家属访问码"
            value={value}
            onChange={(v) => setValue(v.trim())}
            clearable
            style={{
              flex: 1,
              border: '1.5px solid #e2d2bd',
              borderRadius: 12,
              padding: '6px 14px',
              fontSize: 15,
              '--font-size': '15px',
            } as CSSProperties}
          />
          <Button
            color="primary"
            onClick={() => {
              if (!value) {
                Toast.show('请输入访问码');
                return;
              }
              localStorage.setItem('family_token', value);
              onSaved(value);
            }}
            style={{
              borderRadius: 12,
              background: 'linear-gradient(135deg,#e8734a,#c8552e)',
              fontWeight: 700,
            }}
          >
            进入
          </Button>
        </div>
        <div style={{ marginTop: 26 }}>
          <ErrorBlock
            status="empty"
            title="没有访问码？"
            description="请联系社区管家获取，访问码与您的手机号绑定，仅限查看您本人相关的处置信息。"
          />
        </div>
      </div>
    </div>
  );
}
