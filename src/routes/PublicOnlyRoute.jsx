import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function PublicOnlyRoute() {
    const { token, loading } = useAuth();

    // poczekaj aż AuthContext sprawdzi token z localStorage (/auth/me)
    if (loading) return <div style={{ padding: 20, color: "white" }}>Loading...</div>;

    // jeśli zalogowany -> nie wpuszczaj na /login i /register
    if (token) return <Navigate to="/home" replace />;

    return <Outlet />;
}
