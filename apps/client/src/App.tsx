import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { App as AntApp } from "antd";
import AdminApp from "./admin/AdminApp";
import H5App from "./h5/H5App";
import EntryPage from "./EntryPage";

/**
 * 双入口：
 * - /admin  管家 PC 管理端（antd）
 * - /m      家属 H5 端（antd-mobile）
 * - 其余路径进入入口引导页
 */
export default function App() {
  return (
    <AntApp>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<EntryPage />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/m" element={<H5App />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AntApp>
  );
}
