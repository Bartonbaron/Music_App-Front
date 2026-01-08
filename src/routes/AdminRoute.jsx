import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ADMIN_ROLE_ID = Number(import.meta.env.VITE_ADMIN_ROLE_ID);

export default function AdminRoute() {
    const { user, token, loading } = useAuth();

    if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
    if (!token || !user) return <Navigate to="/login" replace />;

    if (!Number.isFinite(ADMIN_ROLE_ID)) return <Navigate to="/home" replace />;
    if (Number(user.roleID) !== ADMIN_ROLE_ID) return <Navigate to="/home" replace />;

    return <Outlet />;
}
