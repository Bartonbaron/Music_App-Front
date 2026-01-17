import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, User as UserIcon, Calendar, Shield, ListMusic, Flag } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { fetchPublicUser, fetchPublicUserPlaylists } from "../../api/users/users.api.js";
import { apiFetch } from "../../api/http";

function formatFullDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function pickPlaylistCover(p) {
    return p?.signedCover || p?.coverSigned || p?.coverURL || null;
}

function pickPlaylistName(p) {
    return p?.playlistName || p?.name || "Playlista";
}

function pickItemsCount(p) {
    const n =
        p?.itemsCount ??
        p?.songsCount ??
        p?.tracksCount ??
        p?.songs?.length ??
        p?.items?.length ??
        null;

    const num = Number(n);
    return Number.isFinite(num) ? num : null;
}

export default function PublicUserPage() {
    const navigate = useNavigate();
    const params = useParams();
    const userID = params.id ?? params.userID;

    const { token, user: authUser } = useAuth();

    const [user, setUser] = useState(null);
    const [playlists, setPlaylists] = useState([]);

    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const [toast, setToast] = useState(null);
    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1600);
    }, []);

    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState("");
    const [reportBusy, setReportBusy] = useState(false);

    const load = useCallback(async () => {
        if (!token) {
            setMsg("Zaloguj się, aby zobaczyć profil użytkownika.");
            setUser(null);
            setPlaylists([]);
            return;
        }
        if (!userID) {
            setMsg("Brak ID użytkownika.");
            setUser(null);
            setPlaylists([]);
            return;
        }

        setLoading(true);
        setMsg("");

        try {
            const [uRes, pRes] = await Promise.all([
                fetchPublicUser({ token, userID }),
                fetchPublicUserPlaylists(token, userID),
            ]);

            setUser(uRes?.user ?? null);
            setPlaylists(Array.isArray(pRes) ? pRes : []);
        } catch (e) {
            setMsg(e?.message || "Nie udało się pobrać danych użytkownika.");
            setUser(null);
            setPlaylists([]);
        } finally {
            setLoading(false);
        }
    }, [token, userID]);

    useEffect(() => {
        load();
    }, [load]);

    const avatarSrc = user?.signedProfilePicURL || user?.profilePicSigned || null;
    const roleName = user?.role?.roleName || user?.roleName || user?.role || "—";
    const createdAtLabel = useMemo(() => formatFullDate(user?.createdAt), [user?.createdAt]);

    const isSelf = useMemo(() => {
        const viewed = Number(userID);
        const me = Number(authUser?.userID ?? authUser?.id);
        if (!Number.isFinite(viewed) || !Number.isFinite(me)) return false;
        return viewed === me;
    }, [userID, authUser]);

    const handleReportUser = useCallback(async () => {
        if (!token) return;
        if (!userID) return;

        if (isSelf) {
            showToast("Nie możesz zgłosić samego siebie", "error");
            return;
        }

        const contentID = Number(userID);
        if (!Number.isFinite(contentID) || contentID <= 0) {
            showToast("Nieprawidłowe ID użytkownika", "error");
            return;
        }

        const reason = String(reportReason || "").trim();
        if (reason.length < 3) {
            showToast("Podaj krótki powód (min. 3 znaki)", "error");
            return;
        }

        setReportBusy(true);
        try {
            await apiFetch("/reports", {
                token,
                method: "POST",
                body: {
                    contentType: "user",
                    contentID,
                    reason,
                },
            });

            showToast("Zgłoszenie wysłane", "success");
            setReportOpen(false);
            setReportReason("");
        } catch (e) {
            showToast(e?.message || "Nie udało się wysłać zgłoszenia", "error");
        } finally {
            setReportBusy(false);
        }
    }, [token, userID, isSelf, reportReason, showToast]);

    if (!token) {
        return (
            <div style={styles.page}>
                <div style={{ opacity: 0.75 }}>Zaloguj się, aby zobaczyć profil użytkownika.</div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            {/* TOAST */}
            {toast ? (
                <div
                    style={{
                        position: "fixed",
                        right: 18,
                        bottom: 110,
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid #2a2a2a",
                        color: "white",
                        zIndex: 999,
                        fontSize: 13,
                        background: toast.type === "error" ? "#2a1515" : "#142015",
                        borderColor: toast.type === "error" ? "#7a2a2a" : "#2a7a3a",
                    }}
                >
                    {toast.text}
                </div>
            ) : null}

            {/* TOP BAR */}
            <div style={styles.topBar}>
                <button type="button" onClick={() => navigate(-1)} style={styles.backBtn} title="Wstecz">
                    <ArrowLeft size={18} style={{ display: "block" }} />
                </button>
                <div style={{ opacity: 0.75, fontSize: 13 }}>Profil użytkownika</div>
            </div>

            {loading ? <div style={{ opacity: 0.75 }}>Ładowanie…</div> : null}
            {msg ? <div style={styles.hint}>{msg}</div> : null}
            {!loading && !msg && !user ? <div style={styles.hint}>Nie znaleziono użytkownika.</div> : null}

            {user ? (
                <>
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

                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={styles.kicker}>UŻYTKOWNIK</div>
                                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                    <h1 style={styles.h1} title={user.userName || "Użytkownik"}>
                                        {user.userName || "Użytkownik"}
                                    </h1>

                                    {/* Zgłoś użytkownika */}
                                    <button
                                        type="button"
                                        onClick={() => setReportOpen(true)}
                                        disabled={isSelf}
                                        title={isSelf ? "Nie możesz zgłosić siebie" : "Zgłoś użytkownika"}
                                        style={{
                                            borderRadius: 12,
                                            border: "1px solid #3a1d1d",
                                            background: "#231010",
                                            color: "#ffb4b4",
                                            padding: "10px 12px",
                                            fontWeight: 900,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 8,
                                            opacity: isSelf ? 0.45 : 1,
                                            cursor: isSelf ? "not-allowed" : "pointer",
                                            whiteSpace: "nowrap",
                                            flex: "0 0 auto",
                                        }}
                                    >
                                        <Flag size={16} style={{ display: "block" }} />
                                        Zgłoś
                                    </button>
                                </div>

                                <div style={styles.metaLine}>

                                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                    <Shield size={14} style={{ display: "block", opacity: 0.85 }} />
                                    <span style={{ opacity: 0.9 }}>{roleName}</span>
                                </span>

                                    <span style={{ opacity: 0.65 }}> • </span>

                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                        <Calendar size={14} style={{ display: "block", opacity: 0.85 }} />
                                        <span style={{ opacity: 0.9 }}>{createdAtLabel}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PUBLIC PLAYLISTS */}
                    <div style={{ ...styles.card, marginTop: 14 }}>
                        <div style={styles.sectionTitleRow}>
                            <ListMusic size={16} style={{ display: "block", opacity: 0.85 }} />
                            <div style={styles.sectionTitle}>Publiczne playlisty</div>
                            <div style={{ marginLeft: "auto", opacity: 0.65, fontSize: 12 }}>{playlists.length}</div>
                        </div>

                        {playlists.length === 0 ? (
                            <div style={styles.hintInline}>Brak publicznych playlist.</div>
                        ) : (
                            <div style={styles.list}>
                                {playlists.map((p) => {
                                    const cover = pickPlaylistCover(p);
                                    const name = pickPlaylistName(p);
                                    const count = pickItemsCount(p);
                                    const pid = p?.playlistID ?? p?.id ?? null;

                                    return (
                                        <div
                                            key={pid ?? `${name}-${p?.createdAt ?? ""}`}
                                            style={styles.item}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => pid && navigate(`/playlists/${pid}`)}
                                            onKeyDown={(e) => {
                                                if (!pid) return;
                                                if (e.key === "Enter" || e.key === " ") navigate(`/playlists/${pid}`);
                                            }}
                                            title={name}
                                        >
                                            <div style={styles.itemCover}>
                                                {cover ? <img src={cover} alt="" style={styles.itemCoverImg} /> : <div style={styles.itemCoverPh} />}
                                            </div>

                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={styles.itemTitle}>{name}</div>
                                                <div style={styles.itemSub}>{count != null ? `${count} utw.` : "—"}</div>
                                            </div>

                                            <div style={styles.openHint}>Otwórz</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            ) : null}

            {/* MODAL: Zgłoś użytkownika */}
            {reportOpen ? (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.55)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1200,
                        padding: 16,
                    }}
                    onMouseDown={(e) => {
                        if (reportBusy) return;
                        if (e.target === e.currentTarget) setReportOpen(false);
                    }}
                >
                    <div
                        style={{
                            width: "min(520px, 100%)",
                            borderRadius: 14,
                            border: "1px solid #2a2a2a",
                            background: "#121212",
                            padding: 14,
                            boxShadow: "0 18px 48px rgba(0,0,0,0.55)",
                        }}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                        }}
                    >
                        <div style={{ fontWeight: 900, marginBottom: 10 }}>
                            Zgłoś użytkownika: <span style={{ opacity: 0.9 }}>{user?.userName || "Użytkownik"}</span>
                        </div>

                        <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>
                            Opisz krótko powód zgłoszenia. Moderacja zweryfikuje sprawę.
                        </div>

                        <textarea
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            placeholder="Np. obraźliwa nazwa / podszywanie się / spam…"
                            rows={4}
                            disabled={reportBusy}
                            style={{
                                width: "100%",
                                boxSizing: "border-box",
                                resize: "vertical",
                                borderRadius: 12,
                                border: "1px solid #2a2a2a",
                                background: "#1a1a1a",
                                color: "white",
                                padding: 12,
                                outline: "none",
                                fontSize: 13,
                                marginBottom: 12,
                                opacity: reportBusy ? 0.7 : 1,
                            }}
                        />

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <button
                                type="button"
                                onClick={() => setReportOpen(false)}
                                disabled={reportBusy}
                                style={{
                                    borderRadius: 12,
                                    border: "1px solid #2a2a2a",
                                    background: "transparent",
                                    color: "white",
                                    padding: "10px 12px",
                                    fontWeight: 800,
                                    opacity: reportBusy ? 0.6 : 0.9,
                                    cursor: reportBusy ? "not-allowed" : "pointer",
                                }}
                            >
                                Anuluj
                            </button>

                            <button
                                type="button"
                                onClick={handleReportUser}
                                disabled={reportBusy}
                                style={{
                                    borderRadius: 12,
                                    border: "1px solid #3a1d1d",
                                    background: "#231010",
                                    color: "#ffb4b4",
                                    padding: "10px 12px",
                                    fontWeight: 900,
                                    opacity: reportBusy ? 0.6 : 1,
                                    cursor: reportBusy ? "not-allowed" : "pointer",
                                }}
                            >
                                {reportBusy ? "Wysyłanie…" : "Wyślij zgłoszenie"}
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
    topBar: { display: "flex", alignItems: "center", gap: 12, marginBottom: 18 },
    backBtn: {
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
        lineHeight: 0,
        cursor: "pointer",
    },
    hint: {
        background: "#1b1b1b",
        border: "1px solid #2a2a2a",
        padding: 12,
        borderRadius: 12,
        opacity: 0.85,
        fontSize: 13,
        marginBottom: 12,
    },
    hintInline: { opacity: 0.75, fontSize: 13, padding: "6px 2px" },
    card: { background: "#1e1e1e", borderRadius: 14, border: "1px solid #2a2a2a", padding: 16 },
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
    sectionTitleRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
    sectionTitle: { fontWeight: 900, opacity: 0.95 },
    list: { display: "flex", flexDirection: "column", gap: 10 },
    item: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "#141414",
        cursor: "pointer",
    },
    itemCover: { width: 44, height: 44, borderRadius: 12, overflow: "hidden", background: "#2a2a2a", flex: "0 0 auto" },
    itemCoverImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
    itemCoverPh: { width: "100%", height: "100%", background: "#2a2a2a" },
    itemTitle: { fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    itemSub: { fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    openHint: {
        opacity: 0.55,
        fontSize: 12,
        border: "1px solid #2a2a2a",
        padding: "6px 10px",
        borderRadius: 999,
        userSelect: "none",
    },
};