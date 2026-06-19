import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Workflows from "./pages/Workflows";
import Drawings from "./pages/Drawings";
import DPR from "./pages/DPR";
import Quality from "./pages/Quality";
import Hindrances from "./pages/Hindrances";
import Finance from "./pages/Finance";
import Analytics from "./pages/Analytics";
import MyActions from "./pages/MyActions";
import WorkflowTemplates from "./pages/WorkflowTemplates";
import AuditLog from "./pages/AuditLog";
import RoleRoute from "./components/RoleRoute";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="my-actions" element={<MyActions />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="workflows" element={<Workflows />} />
            <Route path="drawings" element={<Drawings />} />
            <Route path="dpr" element={<DPR />} />
            <Route path="quality" element={<Quality />} />
            <Route path="hindrances" element={<Hindrances />} />
            <Route path="finance" element={<Finance />} />
            <Route path="analytics" element={<Analytics />} />
            <Route
              path="workflow-templates"
              element={
                <RoleRoute roles={["admin", "ProjectCoordinator"]}>
                  <WorkflowTemplates />
                </RoleRoute>
              }
            />
            <Route
              path="audit-log"
              element={
                <RoleRoute roles={["admin", "ProjectCoordinator"]}>
                  <AuditLog />
                </RoleRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
