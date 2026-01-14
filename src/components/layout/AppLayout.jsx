import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

import { useCallback, useState } from "react";

import PlayerBar from "../player/PlayerBar";
import Sidebar from "../common/Sidebar";
import TopBar from "../common/TopBar";

export default function AppLayout() {
    const { token, loading } = useAuth();

    const [lockMainScroll, setLockMainScroll] = useState(false);

    const onSidebarHover = useCallback((isHovering) => {
        setLockMainScroll(!!isHovering);
    }, []);

    if (loading) {
        return <div style={{ color: "white", padding: 20 }}>Ładowanie...</div>;
    }

    if (!token) return <Navigate to="/login" replace />;

    return (
        <div style={styles.shell}>
            <aside style={styles.sidebar}>
                <Sidebar onHoverChange={onSidebarHover} />
            </aside>

            <div style={styles.rightCol}>
                <TopBar />

                <main
                    style={{
                        ...styles.main,
                        overflowY: "scroll",
                        scrollbarGutter: "stable",
                        pointerEvents: lockMainScroll ? "none" : "auto",
                    }}
                >
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
        height: "100vh",
        overflow: "hidden",
        background: "#121212",
        color: "white",
        display: "flex",
    },

    sidebar: {
        width: 280,
        height: "100vh",
        overflow: "hidden",
        borderRight: "1px solid #2a2a2a",
        background: "#0f0f0f",
        padding: 14,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        minWidth: 280,
    },

    rightCol: {
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
    },

    main: {
        flex: 1,
        minWidth: 0,
        scrollbarGutter: "stable",
    },

    content: {
        padding: "20px 28px 120px",
        boxSizing: "border-box",
    },
};