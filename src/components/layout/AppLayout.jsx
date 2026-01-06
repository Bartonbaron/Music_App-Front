import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

import PlayerBar from "../player/PlayerBar";
import Sidebar from "../common/Sidebar";
import TopBar from "../common/TopBar";

export default function AppLayout() {
    const { token, loading } = useAuth();

    if (loading) {
        return <div style={{ color: "white", padding: 20 }}>Ładowanie...</div>;
    }

    if (!token) return <Navigate to="/login" replace />;

    return (
        <div style={styles.shell}>
            <aside style={styles.sidebar}>
                <Sidebar />
            </aside>

            <div style={styles.rightCol}>
                <TopBar />

                <main style={styles.main}>
                    <div style={styles.content}>
                        <Outlet />
                    </div>
                </main>

                <PlayerBar />
            </div>
        </div>
    );
}

const styles = {
    shell: {
        minHeight: "100vh",
        background: "#121212",
        color: "white",
        display: "flex",
    },

    sidebar: {
        width: 280,
        borderRight: "1px solid #2a2a2a",
        background: "#0f0f0f",
        padding: 14,
        boxSizing: "border-box",
    },

    rightCol: {
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
    },

    main: {
        flex: 1,
        minWidth: 0,
        overflow: "auto",
    },

    content: {
        padding: "20px 28px 120px",
        boxSizing: "border-box",
    },
};