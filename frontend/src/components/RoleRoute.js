import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function RoleRoute({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return (
      <div className="card-flat p-8 text-center" data-testid="role-denied">
        <div className="text-overline text-red-700">Access Denied</div>
        <h2 className="font-display text-xl font-bold text-slate-900 mt-2">
          You don't have permission to view this page.
        </h2>
        <p className="text-sm text-slate-600 mt-2">
          This area is restricted to <span className="font-mono">{roles.join(" / ")}</span> roles.
        </p>
      </div>
    );
  }
  return children;
}
