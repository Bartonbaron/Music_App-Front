import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Home, User as UserIcon, LogOut, ChevronDown, Pencil, BarChart3,
    Flag, Users as UsersIcon, Tags, Bell, Mic2 } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { SearchBox } from "../search/SearchBox.jsx";

const ADMIN_ROLE_ID = Number(import.meta.env.VITE_ADMIN_ROLE_ID);

const topbarIcon18 = { display: "block", width: 18, height: 18 };
const topbarIcon16 = { display: "block", width: 16, height: 16 };

const baseTopBtn = {
    padding: 0,
    boxSizing: "border-box",
    lineHeight: 0,
    fontSize: 14,
    border: "1px solid #2a2a2a",
    background: "#1a1a1a",
    color: "white",
    cursor: "pointer",
    transition: "background 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

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
        if (typeof logout === "function") logout();
        else console.warn("AuthContext: brak funkcji logout()");
    }, [logout, close]);

    const userNameTooltip = user?.userName ? `Zalogowany jako: ${user.userName}` : "Profil";

    const onGoProfile = useCallback(() => {
        close();
        navigate("/me");
    }, [close, navigate]);

    const onGoCreatorPanel = useCallback(() => {
        close();
        navigate("/creator/me");
    }, [close, navigate]);

    const onGoFollowersStats = useCallback(() => {
        close();
        navigate("/creator/followers");
    }, [close, navigate]);

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

    const onGoAdminGenres = useCallback(() => {
        close();
        navigate("/admin/genres");
    }, [close, navigate]);

    const onGoAdminTopics = useCallback(() => {
        close();
        navigate("/admin/topics");
    }, [close, navigate]);

    return (
        <header style={styles.wrap}>
            <div style={styles.inner}>
                {/* LEFT */}
                <button
                    type="button"
                    onClick={() => navigate("/home")}
                    style={styles.homeBtn}
                    title="Strona główna"
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#242424")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                >
                    <Home size={18} style={topbarIcon18} />
                </button>

                {/* CENTER */}
                <SearchBox />

                {/* RIGHT */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                        type="button"
                        onClick={() => navigate("/feed")}
                        style={styles.iconBtn}
                        title="Nowości od obserwowanych"
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#242424")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                    >
                        <Bell size={18} style={topbarIcon18} />
                    </button>

                    <div style={{ position: "relative" }}>
                        <button
                            ref={btnRef}
                            type="button"
                            onClick={() => setOpen((v) => !v)}
                            style={styles.profileBtn}
                            title={userNameTooltip}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#242424")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                        >
                            {avatarSrc ? (
                                <img src={avatarSrc} alt="" style={styles.avatar} referrerPolicy="no-referrer" crossOrigin="anonymous" />
                            ) : (
                                <div style={styles.avatarFallback}>
                                    <UserIcon size={18} style={topbarIcon18} />
                                </div>
                            )}

                            <ChevronDown size={16} style={{ ...topbarIcon16, opacity: 0.8 }} />
                        </button>

                        {open && (
                            <div ref={menuRef} style={styles.menu}>
                                <button type="button" style={styles.menuItem} onClick={onGoProfile}>
                                    <UserIcon size={16} style={{ display: "block", width: 16, height: 16 }} />
                                    <span>Profil</span>
                                </button>

                                {isCreator ? (
                                    <>
                                        <button type="button" style={styles.menuItem} onClick={onGoCreatorPanel}>
                                            <Pencil size={16} style={{ display: "block", width: 16, height: 16 }} />
                                            <span>Edytuj profil twórcy</span>
                                        </button>

                                        <button type="button" style={styles.menuItem} onClick={onGoFollowersStats} title="Statystyki obserwujących">
                                            <UsersIcon size={16} style={{ display: "block" }} />
                                            <span style={{ flex: 1, textAlign: "left" }}>Obserwujący</span>
                                        </button>
                                    </>
                                ) : null}

                                {isAdmin ? (
                                    <>
                                        <div style={styles.sep} />
                                        <div style={styles.menuSectionLabel}>Administracja</div>

                                        <button type="button" style={styles.menuItem} onClick={onGoAdminStats}>
                                            <BarChart3 size={16} style={{ display: "block", width: 16, height: 16 }} />
                                            <span>Statystyki</span>
                                        </button>

                                        <button type="button" style={styles.menuItem} onClick={onGoAdminReports}>
                                            <Flag size={16} style={{ display: "block", width: 16, height: 16 }} />
                                            <span>Zgłoszenia</span>
                                        </button>

                                        <button type="button" style={styles.menuItem} onClick={onGoAdminUsers}>
                                            <UsersIcon size={16} style={{ display: "block", width: 16, height: 16 }} />
                                            <span>Użytkownicy</span>
                                        </button>

                                        <button type="button" style={styles.menuItem} onClick={onGoAdminGenres}>
                                            <Tags size={16} style={{ display: "block", width: 16, height: 16 }} />
                                            <span>Gatunki</span>
                                        </button>

                                        <button type="button" style={styles.menuItem} onClick={onGoAdminTopics}>
                                            <Mic2 size={16} style={{ display: "block", width: 16, height: 16 }} />
                                            <span>Tematy</span>
                                        </button>
                                    </>
                                ) : null}

                                <div style={styles.sep} />
                                <button type="button" style={{ ...styles.menuItem, color: "#ffb4b4" }} onClick={onLogout}>
                                    <LogOut size={16} style={{ display: "block", width: 16, height: 16 }} />
                                    <span>Wyloguj</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}

const styles = {
    wrap: { position: "sticky", top: 0, zIndex: 50, background: "#121212", borderBottom: "1px solid #2a2a2a" },
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
        ...baseTopBtn,
        width: 36,
        height: 36,
        borderRadius: 999
    },

    iconBtn: {
        ...baseTopBtn,
        width: 36,
        height: 36,
        borderRadius: 999
    },

    profileBtn: {
        ...baseTopBtn,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transform: "translateY(3px)",
        gap: 8,
        height: 36,
        padding: "0 8px 0 0",
        borderRadius: 999,
    },

    avatar: {
        width: 36,
        height: 36,
        borderRadius: "50%",
        objectFit: "cover",
        display: "block",
    },

    avatarFallback: {
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "#141414",
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
        textAlign: "left",
        transition: "background 0.15s",
    },

    menuSectionLabel: {
        padding: "10px 12px 6px 12px",
        color: "#bdbdbd",
        fontWeight: 900,
        fontSize: 11,
        letterSpacing: 0.6,
        textTransform: "uppercase",
    },

    sep: {
        height: 1,
        background: "#2a2a2a",
        margin: "4px 0",
    },
};