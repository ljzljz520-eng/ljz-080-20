import { Layout, Menu } from 'antd';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  IconAlert,
  IconContacts,
  IconHome,
  IconList,
} from './Icons';
import EldersPage from './EldersPage';
import EventsPage from './EventsPage';
import EventDetailPage from './EventDetailPage';
import './admin.less';

const { Sider, Content, Header } = Layout;

const MENU = [
  { key: '/admin/events', icon: <IconAlert />, label: <Link to="/admin/events">突发事件</Link> },
  { key: '/admin/elders', icon: <IconContacts />, label: <Link to="/admin/elders">老人与联系人</Link> },
];

export default function AdminApp() {
  const location = useLocation();
  const selectedKey =
    MENU.find((m) => location.pathname.startsWith(m.key))?.key ??
    '/admin/events';

  return (
    <Layout className="admin-layout">
      <Sider width={224} className="admin-sider" breakpoint="lg" collapsedWidth="64">
        <div className="admin-logo">
          <span className="logo-mark">护</span>
          <span className="logo-text">
            幸福里·智慧照护
            <small>社区管家工作台</small>
          </span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={MENU}
          className="admin-menu"
        />
        <div className="sider-foot">
          <IconHome /> <Link to="/">返回入口</Link>
        </div>
      </Sider>
      <Layout>
        <Header className="admin-header">
          <IconList /> 紧急联系人分级呼叫
          <span className="header-badge">
            <span className="pulse-dot" /> 7×24 值守中
          </span>
        </Header>
        <Content className="admin-content">
          <Routes>
            <Route index element={<Navigate to="events" replace />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="events/:eventId" element={<EventDetailPage />} />
            <Route path="elders" element={<EldersPage />} />
            <Route path="*" element={<Navigate to="events" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}
