import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {Home, User as UserIcon, LogOut, ChevronDown, Pencil, Shield, BarChart3, Flag, Users as UsersIcon,} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const ADMIN_ROLE_ID = Number(import.meta.env.VITE_ADMIN_ROLE_ID);

export default function TopBar() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const isCreator = useMemo(() => user?.role?.roleName === "Creator", [user?.role?.roleName]);

    const isAdmin = useMemo(() => {
        if (!Number.isFinite(ADMIN_ROLE_ID)) return false;
        return Number(user?.roleID) === ADMIN_ROLE_ID;
    }, [user?.roleID]);

    const avatarSrc = user?.signedProfilePicURL || null;

    const [open, setOpen] = useState(false);
    const btnRef = useRef(null);
    const menuRef = useRef(null);

    const close = useCallback(() => setOpen(false), []);

    // zamykanie po kliknięciu poza menu
    useEffect(() => {
        if (!open) return;

        const onDown = (e) => {
            const t = e.target;
            if (menuRef.current?.contains(t)) return;
            if (btnRef.current?.contains(t)) return;
            close();
        };

        const onKey = (e) => {
            if (e.key === "Escape") close();
        };

        document.addEventListener("mousedown", onDown);
        document.addEventListener("touchstart", onDown, { passive: true });
        document.addEventListener("keydown", onKey);

        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("touchstart", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open, close]);

    const onLogout = useCallback(() => {
        close();
        if (typeof logout === "function") {
            logout();
        } else {
            console.warn("AuthContext: brak funkcji logout()");
        }
    }, [logout, close]);

    const profileLabel = "Profil";
    const userNameTooltip = user?.userName ? `Zalogowany jako: ${user.userName}` : "Profil";

    const onGoProfile = useCallback(() => {
        close();
        navigate("/me");
    }, [close, navigate]);

    const onGoCreatorPanel = useCallback(() => {
        close();
        navigate("/creator/me");
    }, [close, navigate]);

    // Trasy admina
    const onGoAdminStats = useCallback(() => {
        close();
        navigate("/admin/stats");
    }, [close, navigate]);

    const onGoAdminReports = useCallback(() => {
        close();
        navigate("/admin/reports");
    }, [close, navigate]);

    const onGoAdminUsers = useCallback(() => {
        close();
        navigate("/admin/users");
    }, [close, navigate]);

    return (
        <header style={styles.wrap}>
            <div style={styles.inner}>
                {/* LEFT: HOME */}
                <button
                    type="button"
                    onClick={() => navigate("/home")}
                    style={styles.homeBtn}
                    title="Strona główna"
                >
                    <Home size={18} />
                </button>

                {/* CENTER */}
                <div />

                {/* RIGHT: AVATAR MENU */}
                <div style={{ position: "relative" }}>
                    <button
                        ref={btnRef}
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        style={styles.profileBtn}
                        title={userNameTooltip}
                        aria-haspopup="menu"
                        aria-expanded={open ? "true" : "false"}
                    >
                        {avatarSrc ? (
                            <img
                                src={avatarSrc}
                                alt=""
                                style={styles.avatar}
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                            />
                        ) : (
                            <div style={styles.avatarFallback}>
                                <UserIcon size={18} />
                            </div>
                        )}

                        <ChevronDown size={16} style={{ opacity: 0.8 }} />
                    </button>

                    {open ? (
                        <div ref={menuRef} style={styles.menu} role="menu" aria-label="Menu profilu">
                            <button
                                type="button"
                                style={styles.menuItem}
                                role="menuitem"
                                onClick={onGoProfile}
                            >
                                <UserIcon size={16} style={{ display: "block" }} />
                                <span style={{ flex: 1, textAlign: "left" }}>{profileLabel}</span>
                            </button>

                            {/* Opcja tylko dla roli Creator */}
                            {isCreator ? (
                                <button
                                    type="button"
                                    style={styles.menuItem}
                                    role="menuitem"
                                    onClick={onGoCreatorPanel}
                                    title="Edytuj profil twórcy"
                                >
                                    <Pencil size={16} style={{ display: "block" }} />
                                    <span style={{ flex: 1, textAlign: "left" }}>Edytuj profil twórcy</span>
                                </button>
                            ) : null}

                            {/* Opcje tylko dla Administratora */}
                            {isAdmin ? (
                                <>
                                    <div style={styles.sep} />

                                    <button
                                        type="button"
                                        style={styles.menuItem}
                                        role="menuitem"
                                        onClick={onGoAdminStats}
                                        title="Admin dashboard"
                                    >
                                        <BarChart3 size={16} style={{ display: "block" }} />
                                        <span style={{ flex: 1, textAlign: "left" }}>Statystki globalne</span>
                                    </button>

                                    <button
                                        type="button"
                                        style={styles.menuItem}
                                        role="menuitem"
                                        onClick={onGoAdminReports}
                                        title="Moderacja zgłoszeń"
                                    >
                                        <Flag size={16} style={{ display: "block" }} />
                                        <span style={{ flex: 1, textAlign: "left" }}>Zgłoszenia</span>
                                    </button>

                                    <button
                                        type="button"
                                        style={styles.menuItem}
                                        role="menuitem"
                                        onClick={onGoAdminUsers}
                                        title="Moderacja użytkowników"
                                    >
                                        <UsersIcon size={16} style={{ display: "block" }} />
                                        <span style={{ flex: 1, textAlign: "left" }}>Użytkownicy</span>
                                    </button>
                                </>
                            ) : null}

                            <div style={styles.sep} />

                            <button
                                type="button"
                                style={{ ...styles.menuItem, color: "#ffb4b4" }}
                                role="menuitem"
                                onClick={onLogout}
                            >
                                <LogOut size={16} style={{ display: "block" }} />
                                <span style={{ flex: 1, textAlign: "left" }}>Wyloguj</span>
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
        </header>
    );
}

const styles = {
    wrap: {
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#121212",
        borderBottom: "1px solid #2a2a2a",
    },

    inner: {
        height: 56,
        padding: "0 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        boxSizing: "border-box",
    },

    homeBtn: {
        width: 36,
        height: 36,
        borderRadius: 999,
        border: "1px solid #2a2a2a",
        background: "#1a1a1a",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
    },

    profileBtn: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 36,
        padding: "0 8px 0 0",
        borderRadius: 999,
        border: "1px solid #2a2a2a",
        background: "#1a1a1a",
        color: "white",
        cursor: "pointer",
    },

    avatar: {
        width: 34,
        height: 34,
        borderRadius: "50%",
        objectFit: "cover",
        border: "1px solid #2a2a2a",
        display: "block",
    },

    avatarFallback: {
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: "#141414",
        border: "1px solid #2a2a2a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
    },

    menu: {
        position: "absolute",
        right: 0,
        top: 44,
        width: 230,
        background: "#1b1b1b",
        border: "1px solid #2a2a2a",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
    },

    menuItem: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: "transparent",
        border: "none",
        color: "white",
        cursor: "pointer",
        fontWeight: 800,
    },

    menuSectionLabel: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px 6px 12px",
        color: "#bdbdbd",
        fontWeight: 900,
        fontSize: 12,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        userSelect: "none",
    },

    sep: {
        height: 1,
        background: "#2a2a2a",
    },
};