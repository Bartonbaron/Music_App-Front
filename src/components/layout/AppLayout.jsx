import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import PlayerBar from "../player/PlayerBar";

export default function AppLayout() {
    const { token, loading } = useAuth();

    if (loading) {
        return <div style={{ color: "white", padding: 20 }}>Ładowanie...</div>;
    }

    if (!token) return <Navigate to="/login" replace />;

    return (
        <div style={styles.shell}>
            <div style={styles.content}>
                <Outlet />
            </div>
            <PlayerBar />
        </div>
    );
}

const styles = {
    shell: {
        minHeight: "100vh",
        background: "#121212",
        color: "white",
        display: "flex",
        flexDirection: "column",
    },
    content: {
        flex: 1,
        paddingBottom: 90, // miejsce na PlayerBar
    },
};
