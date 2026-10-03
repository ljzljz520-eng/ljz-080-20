import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import AdminApp from './pages/admin/AdminApp';
import FamilyApp from './pages/h5/FamilyApp';
import './styles/global.less';

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#e8734a',
          borderRadius: 10,
          fontFamily:
            "'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif",
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/admin/*" element={<AdminApp />} />
            <Route path="/h5/*" element={<FamilyApp />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
