import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    User as UserIcon,
    Pencil,
    Save,
    X,
    Lock,
    Mail,
    Calendar,
    Shield,
    SlidersHorizontal,
    Upload,
    Trash2,
} from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {deactivateAccount} from "../../api/users/users.api.js";
const ADMIN_ROLE_ID = Number(import.meta.env.VITE_ADMIN_ROLE_ID);

import {
    fetchMyProfile,
    updateMyProfile,
    changeMyPassword,
    updatePlaybackPreferences,
    uploadMyAvatar,
    deleteMyAvatar,
} from "../../api/users/users.api.js";
import {usePlayer} from "../../contexts/PlayerContext.jsx";

function formatFullDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function clamp(n, a, b) {
    const x = Number(n);
    if (!Number.isFinite(x)) return a;
    return Math.min(b, Math.max(a, x));
}

export default function UserPage() {
    const { token, logout, user } = useAuth();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const [busy, setBusy] = useState(false);
    const navigate = useNavigate();

    const [toast, setToast] = useState(null);
    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1400);
    }, []);

    const [avatarBusy, setAvatarBusy] = useState(false);
    const fileInputRef = useRef(null);
    const avatarSrc = profile?.signedProfilePicURL || null;

    const [editOpen, setEditOpen] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);

    const [editUserName, setEditUserName] = useState("");
    const [editEmail, setEditEmail] = useState("");

    const [passOpen, setPassOpen] = useState(false);
    const [changingPass, setChangingPass] = useState(false);
    const [oldPass, setOldPass] = useState("");
    const [newPass, setNewPass] = useState("");

    const [prefsSaving, setPrefsSaving] = useState(false);
    const [volumeUI, setVolumeUI] = useState(80); // 0..100
    const [modeUI, setModeUI] = useState("normal"); // normal/shuffle/repeat
    const [autoplayUI, setAutoplayUI] = useState(true);
    const { setVolumePref, setPlaybackModePref, setAutoplayPref } = usePlayer();

    const fetchMe = useCallback(async () => {
        if (!token) return;

        setLoading(true);
        setMsg("");
        try {
            const data = await fetchMyProfile(token);

            const u = data?.user ?? null;
            setProfile(u);

            const v = clamp(u?.volume ?? 0.8, 0, 1);
            setVolumeUI(Math.round(v * 100));
            setModeUI(u?.playbackMode || "normal");
            setAutoplayUI(Boolean(u?.autoplay));
        } catch (e) {
            setMsg(e?.message || "Błąd pobierania profilu");
            setProfile(null);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (!token) {
            setProfile(null);
            setMsg("Zaloguj się, aby zobaczyć profil.");
            return;
        }
        fetchMe();
    }, [token, fetchMe]);

    const roleName = user?.role?.roleName || "—";
    const createdAtLabel = useMemo(() => formatFullDate(profile?.createdAt), [profile?.createdAt]);
    const statusLabel = profile?.status === false ? "Dezaktywowane" : "Aktywne";

    const openEdit = useCallback(() => {
        if (!profile) return;
        setEditUserName(profile.userName || "");setEditEmail(profile.email || "");
        setEditOpen(true);
    }, [profile]);

    const saveProfile = useCallback(async () => {
        if (!token) {
            showToast("Zaloguj się ponownie", "error");
            return;
        }

        setSavingProfile(true);
        try {
            await updateMyProfile(token, {
                userName: editUserName,
                email: editEmail,
            });

            showToast("Zapisano profil", "success");
            setEditOpen(false);
            await fetchMe();
        } catch (e) {
            showToast(e?.message || "Błąd zapisu profilu", "error");
        } finally {
            setSavingProfile(false);
        }
    }, [token, editUserName, editEmail, showToast, fetchMe]);

    const savePassword = useCallback(async () => {
        if (!token) {
            showToast("Zaloguj się ponownie", "error");
            return;
        }

        if (!oldPass || !newPass) {
            showToast("Uzupełnij oba pola hasła", "error");
            return;
        }

        setChangingPass(true);
        try {
            await changeMyPassword(token, { oldPassword: oldPass, newPassword: newPass });

            showToast("Zmieniono hasło", "success");
            setOldPass("");
            setNewPass("");
            setPassOpen(false);
        } catch (e) {
            showToast(e?.message || "Błąd zmiany hasła", "error");
        } finally {
            setChangingPass(false);
        }
    }, [token, oldPass, newPass, showToast]);

    const savePreferences = useCallback(async () => {
        if (!token) {
            showToast("Zaloguj się ponownie", "error");
            return;
        }

        setPrefsSaving(true);
        try {
            const volume = clamp(volumeUI / 100, 0, 1);

            await updatePlaybackPreferences(token, {
                volume,
                playbackMode: modeUI,
                autoplay: Boolean(autoplayUI),
            });

            setVolumePref?.(volume);
            setPlaybackModePref?.(modeUI);
            setAutoplayPref?.(Boolean(autoplayUI));

            showToast("Zapisano preferencje", "success");
            await fetchMe();
        } catch (e) {
            showToast(e?.message || "Błąd preferencji", "error");
        } finally {
            setPrefsSaving(false);
        }
    }, [token, volumeUI, modeUI, autoplayUI, showToast, fetchMe]);

    const handleDeactivate = useCallback(async () => {
        if (!token) return;

        if (profile?.roleID === ADMIN_ROLE_ID) return;

        const ok = window.confirm(
            "Czy na pewno chcesz zdezaktywować konto?\n\n" +
            "Zostaniesz wylogowany, a dostęp do konta zostanie zablokowany."
        );
        if (!ok) return;

        setBusy(true);
        try {
            await deactivateAccount(token);
            alert("Konto zostało zdezaktywowane.");

            logout();
            navigate("/login");
        } catch (e) {
            showToast?.(e.message || "Błąd dezaktywacji konta", "error");
        } finally {
            setBusy(false);
        }
    }, [token, logout, navigate, showToast]);

    const onPickAvatar = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const onAvatarSelected = useCallback(
        async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            setAvatarBusy(true);
            try {
                const data = await uploadMyAvatar(token, file);
                if (data?.user) setProfile(data.user);

                showToast("Zaktualizowano avatar", "success");
            } catch (err) {
                showToast(err?.message || "Nie udało się wgrać avatara", "error");
            } finally {
                setAvatarBusy(false);
                e.target.value = "";
            }
        },
        [token, showToast]
    );

    const onRemoveAvatar = useCallback(async () => {
        if (!token) return;
        const ok = window.confirm("Usunąć avatar?");
        if (!ok) return;

        setAvatarBusy(true);
        try {
            const data = await deleteMyAvatar(token);
            if (data?.user) setProfile(data.user);

            showToast("Usunięto avatar", "success");
        } catch (err) {
            showToast(err?.message || "Nie udało się usunąć avatara", "error");
        } finally {
            setAvatarBusy(false);
        }
    }, [token, showToast]);

    if (!token) {
        return (
            <div style={styles.page}>
                <div style={{ opacity: 0.75 }}>Zaloguj się, aby zobaczyć profil.</div>
            </div>
        );
    }

    if (loading || !profile) return <div style={styles.page}>Ładowanie…</div>;
    if (msg) return <div style={styles.page}>{msg}</div>;

    return (
        <div style={styles.page}>
            {/* TOAST */}
            {toast ? (
                <div
                    style={{
                        ...styles.toast,
                        borderColor: toast.type === "error" ? "#7a2a2a" : "#2a7a3a",
                        background: toast.type === "error" ? "#2a1515" : "#142015",
                    }}
                >
                    {toast.text}
                </div>
            ) : null}

            {/* hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={onAvatarSelected}
                style={{ display: "none" }}
            />

            {/* HEADER CARD */}
            <div style={styles.card}>
                <div style={styles.profileRow}>
                    <div style={styles.avatarWrap}>
                        {avatarSrc ? (
                            <img
                                src={avatarSrc}
                                alt=""
                                style={styles.avatarImg}
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                            />
                        ) : (
                            <div style={styles.avatarFallback}>
                                <UserIcon size={54} style={{ display: "block", opacity: 0.9 }} />
                            </div>
                        )}
                    </div>

                    <div style={{ minWidth: 0 }}>
                        <div style={styles.kicker}>PROFIL</div>

                        <h1 style={styles.h1} title={user?.userName || "Użytkownik"}>
                            {profile?.userName || "Użytkownik"}
                        </h1>

                        <div style={styles.metaLine}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <Mail size={14} style={{ display: "block", opacity: 0.85 }} />
                                <span style={{ opacity: 0.9 }}>{profile?.email || "—"}</span>
                            </span>

                            <span style={{ opacity: 0.65 }}> • </span>

                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <Shield size={14} style={{ display: "block", opacity: 0.85 }} />
                                <span style={{ opacity: 0.9 }}>
                                    {user?.role?.roleName || roleName || "User"}
                                </span>
                            </span>

                            <span style={{ opacity: 0.65 }}> • </span>

                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <Calendar size={14} style={{ display: "block", opacity: 0.85 }} />
                                <span style={{ opacity: 0.9 }}>{createdAtLabel}</span>
                            </span>

                            <span style={{ opacity: 0.65 }}> • </span>

                            <span style={{ opacity: 0.85 }}>{statusLabel}</span>
                        </div>

                        <div style={styles.actions}>
                            <button
                                type="button"
                                onClick={openEdit}
                                style={styles.primaryBtn}
                                title="Edytuj profil"
                            >
                                <Pencil size={16} style={{ display: "block" }} /> Edytuj profil
                            </button>

                            <button
                                type="button"
                                onClick={() => setPassOpen(true)}
                                style={styles.ghostBtn}
                                title="Zmień hasło"
                            >
                                <Lock size={16} style={{ display: "block" }} /> Zmień hasło
                            </button>

                            <button
                                type="button"
                                onClick={onPickAvatar}
                                disabled={avatarBusy}
                                style={{
                                    ...styles.ghostBtn,
                                    opacity: avatarBusy ? 0.6 : 1,
                                    cursor: avatarBusy ? "not-allowed" : "pointer",
                                }}
                                title="Wgraj avatar"
                            >
                                <Upload size={16} style={{ display: "block" }} /> Avatar
                            </button>

                            <button
                                type="button"
                                onClick={onRemoveAvatar}
                                disabled={avatarBusy || !avatarSrc}
                                style={{
                                    ...styles.ghostBtn,
                                    opacity: avatarBusy || !avatarSrc ? 0.6 : 1,
                                    cursor: avatarBusy || !avatarSrc ? "not-allowed" : "pointer",
                                }}
                                title="Usuń avatar"
                            >
                                <Trash2 size={16} style={{ display: "block" }} /> Usuń avatar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* PREFERENCES */}
            <div style={{ ...styles.card, marginTop: 14 }}>
                <div style={styles.cardTitleRow}>
                    <SlidersHorizontal size={16} style={{ display: "block", opacity: 0.85 }} />
                    <div style={styles.cardTitle}>Preferencje odtwarzania</div>
                </div>

                <div style={styles.prefsGrid}>
                    <div style={styles.prefBlock}>
                        <div style={styles.prefLabel}>Głośność</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={volumeUI}
                                onChange={(e) => setVolumeUI(Number(e.target.value))}
                                style={{ width: 260 }}
                            />
                            <div style={{ width: 44, textAlign: "right", opacity: 0.85 }}>{volumeUI}%</div>
                        </div>
                    </div>

                    <div style={styles.prefBlock}>
                        <div style={styles.prefLabel}>Tryb</div>
                        <select value={modeUI} onChange={(e) => setModeUI(e.target.value)} style={styles.select}>
                            <option value="normal">normalny</option>
                            <option value="shuffle">losowy</option>
                            <option value="repeat">zapętlenie</option>
                        </select>
                    </div>

                    <div style={styles.prefBlock}>
                        <div style={styles.prefLabel}>Automatyczne odtwarzanie</div>
                        <label style={styles.toggleRow}>
                            <input
                                type="checkbox"
                                checked={autoplayUI}
                                onChange={(e) => setAutoplayUI(e.target.checked)}
                            />
                            <span style={{ opacity: 0.85 }}>{autoplayUI ? "Włączone" : "Wyłączone"}</span>
                        </label>
                    </div>

                    <div style={styles.prefBlock}>
                        <div style={styles.prefLabel}>&nbsp;</div>
                        <button
                            type="button"
                            onClick={savePreferences}
                            disabled={prefsSaving}
                            style={{
                                ...styles.primaryBtn,
                                opacity: prefsSaving ? 0.6 : 1,
                                cursor: prefsSaving ? "not-allowed" : "pointer",
                            }}
                        >
                            <Save size={16} style={{ display: "block" }} /> Zapisz preferencje
                        </button>
                    </div>
                </div>
            </div>

            {/* DANGER ZONE */}
            {profile?.roleID !== ADMIN_ROLE_ID ? (
                <div style={styles.dangerZone}>
                    <div style={styles.dangerTitle}>Strefa zagrożenia</div>

                    <p style={styles.dangerText}>
                        Dezaktywacja konta spowoduje wylogowanie i zablokowanie dostępu do konta.
                        Operacja jest <strong>odwracalna tylko przez administrację</strong>.
                    </p>

                    <button
                        type="button"
                        onClick={handleDeactivate}
                        disabled={busy}
                        style={{
                            ...styles.dangerBtn,
                            opacity: busy ? 0.6 : 1,
                            cursor: busy ? "not-allowed" : "pointer",
                        }}
                    >
                        Dezaktywuj konto
                    </button>
                </div>
            ) : null}

            {/* EDIT PROFILE MODAL */}
            {editOpen ? (
                <div style={styles.modalOverlay} role="dialog" aria-modal="true">
                    <div style={styles.modal}>
                        <div style={styles.modalHeader}>
                            <div style={{ fontWeight: 900 }}>Edytuj profil</div>
                            <button type="button" onClick={() => setEditOpen(false)} style={styles.iconX} title="Zamknij">
                                <X size={18} style={{ display: "block" }} />
                            </button>
                        </div>

                        <div style={styles.modalBody}>
                            <div style={styles.field}>
                                <div style={styles.label}>Nazwa użytkownika</div>
                                <input
                                    value={editUserName}
                                    onChange={(e) => setEditUserName(e.target.value)}
                                    style={styles.input}
                                    placeholder="userName"
                                />
                            </div>

                            <div style={styles.field}>
                                <div style={styles.label}>Email</div>
                                <input
                                    value={editEmail}
                                    onChange={(e) => setEditEmail(e.target.value)}
                                    style={styles.input}
                                    placeholder="email"
                                />
                            </div>
                        </div>

                        <div style={styles.modalFooter}>
                            <button type="button" onClick={() => setEditOpen(false)} style={styles.ghostBtn} disabled={savingProfile}>
                                Anuluj
                            </button>

                            <button
                                type="button"
                                onClick={saveProfile}
                                style={{
                                    ...styles.primaryBtn,
                                    opacity: savingProfile ? 0.6 : 1,
                                    cursor: savingProfile ? "not-allowed" : "pointer",
                                }}
                                disabled={savingProfile}
                            >
                                <Save size={16} style={{ display: "block" }} /> Zapisz
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* CHANGE PASSWORD MODAL */}
            {passOpen ? (
                <div style={styles.modalOverlay} role="dialog" aria-modal="true">
                    <div style={styles.modal}>
                        <div style={styles.modalHeader}>
                            <div style={{ fontWeight: 900 }}>Zmień hasło</div>
                            <button type="button" onClick={() => setPassOpen(false)} style={styles.iconX} title="Zamknij">
                                <X size={18} style={{ display: "block" }} />
                            </button>
                        </div>

                        <div style={styles.modalBody}>
                            <div style={styles.field}>
                                <div style={styles.label}>Stare hasło</div>
                                <input
                                    type="password"
                                    value={oldPass}
                                    onChange={(e) => setOldPass(e.target.value)}
                                    style={styles.input}
                                    placeholder="••••••••"
                                />
                            </div>

                            <div style={styles.field}>
                                <div style={styles.label}>Nowe hasło</div>
                                <input
                                    type="password"
                                    value={newPass}
                                    onChange={(e) => setNewPass(e.target.value)}
                                    style={styles.input}
                                    placeholder="••••••••"
                                />
                                <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
                                    Min. 8 znaków, wielka litera, cyfra, znak specjalny.
                                </div>
                            </div>
                        </div>

                        <div style={styles.modalFooter}>
                            <button type="button" onClick={() => setPassOpen(false)} style={styles.ghostBtn} disabled={changingPass}>
                                Anuluj
                            </button>

                            <button
                                type="button"
                                onClick={savePassword}
                                style={{
                                    ...styles.primaryBtn,
                                    opacity: changingPass ? 0.6 : 1,
                                    cursor: changingPass ? "not-allowed" : "pointer",
                                }}
                                disabled={changingPass}
                            >
                                <Save size={16} style={{ display: "block" }} /> Zapisz
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <div style={{ height: 120 }} />
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        background: "#121212",
        color: "white",
        padding: "20px 40px",
        paddingBottom: 120,
    },

    toast: {
        position: "fixed",
        right: 18,
        bottom: 110,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        color: "white",
        zIndex: 999,
        fontSize: 13,
    },

    card: {
        background: "#1e1e1e",
        borderRadius: 14,
        border: "1px solid #2a2a2a",
        padding: 16,
    },

    profileRow: { display: "flex", gap: 16, alignItems: "center" },

    avatarWrap: {
        width: 160,
        height: 160,
        borderRadius: 14,
        overflow: "hidden",
        background: "#2a2a2a",
        border: "1px solid #2a2a2a",
        flex: "0 0 auto",
    },
    avatarImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
    avatarFallback: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #2b2b2b, #1f1f1f)",
    },

    kicker: { fontSize: 12, opacity: 0.7, letterSpacing: 1.2, fontWeight: 900 },
    h1: {
        margin: "6px 0 8px",
        fontSize: 38,
        lineHeight: 1.08,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    metaLine: { opacity: 0.9, fontSize: 13, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

    actions: { marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" },

    primaryBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 12,
        border: "none",
        background: "#1db954",
        color: "#000",
        fontWeight: 900,
        cursor: "pointer",
    },

    ghostBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #333",
        background: "transparent",
        color: "white",
        fontWeight: 800,
        cursor: "pointer",
    },

    cardTitleRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
    cardTitle: { fontWeight: 900, opacity: 0.95 },

    prefsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 14,
        alignItems: "end",
    },

    prefBlock: { display: "flex", flexDirection: "column", gap: 8 },
    prefLabel: { fontSize: 12, opacity: 0.7, fontWeight: 800, letterSpacing: 0.6 },

    select: {
        height: 40,
        borderRadius: 12,
        border: "1px solid #333",
        background: "#141414",
        color: "white",
        padding: "0 10px",
        outline: "none",
    },

    toggleRow: { display: "inline-flex", alignItems: "center", gap: 10, userSelect: "none" },

    // MODAL
    modalOverlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 2000,
    },

    modal: {
        width: "min(560px, 100%)",
        background: "#1b1b1b",
        border: "1px solid #2a2a2a",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
    },

    modalHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        borderBottom: "1px solid #2a2a2a",
    },

    iconX: {
        width: 38,
        height: 34,
        borderRadius: 10,
        border: "1px solid #333",
        background: "transparent",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        cursor: "pointer",
    },

    modalBody: { padding: 14, display: "flex", flexDirection: "column", gap: 12 },

    field: { display: "flex", flexDirection: "column", gap: 6 },
    label: { fontSize: 12, opacity: 0.7, fontWeight: 800, letterSpacing: 0.6 },

    input: {
        height: 40,
        borderRadius: 12,
        border: "1px solid #333",
        background: "#141414",
        color: "white",
        padding: "0 12px",
        outline: "none",
    },

    modalFooter: {
        padding: 14,
        borderTop: "1px solid #2a2a2a",
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
    },

    dangerZone: {
        marginTop: 40,
        padding: 16,
        borderRadius: 14,
        border: "1px solid #5a2a2a",
        background: "#1a0f0f",
    },

    dangerTitle: {
        fontWeight: 900,
        color: "#ffb4b4",
        marginBottom: 8,
    },

    dangerText: {
        fontSize: 13,
        opacity: 0.9,
        marginBottom: 12,
        lineHeight: 1.5,
    },

    dangerBtn: {
        borderRadius: 12,
        border: "1px solid #7a2a2a",
        background: "#2a1515",
        color: "#ffb4b4",
        padding: "10px 14px",
        fontWeight: 900,
    },
};