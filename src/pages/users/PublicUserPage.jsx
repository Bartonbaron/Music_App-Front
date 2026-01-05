import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, User as UserIcon, Calendar, Shield, ListMusic } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { fetchPublicUser, fetchPublicUserPlaylists } from "../../api/users.api";

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

    const { token } = useAuth();

    const [user, setUser] = useState(null);
    const [playlists, setPlaylists] = useState([]);

    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

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

            // public-playlists endpoint -> tablica
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

    if (!token) {
        return (
            <div style={styles.page}>
                <div style={{ opacity: 0.75 }}>Zaloguj się, aby zobaczyć profil użytkownika.</div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
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

                            <div style={{ minWidth: 0 }}>
                                <div style={styles.kicker}>UŻYTKOWNIK</div>
                                <h1 style={styles.h1} title={user.userName || "Użytkownik"}>
                                    {user.userName || "Użytkownik"}
                                </h1>

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
                            <div style={{ marginLeft: "auto", opacity: 0.65, fontSize: 12 }}>
                                {playlists.length}
                            </div>
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
                                                {cover ? (
                                                    <img src={cover} alt="" style={styles.itemCoverImg} />
                                                ) : (
                                                    <div style={styles.itemCoverPh} />
                                                )}
                                            </div>

                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={styles.itemTitle}>{name}</div>
                                                <div style={styles.itemSub}>
                                                    {count != null ? `${count} utw.` : "—"}
                                                </div>
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

    topBar: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 18,
    },

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

    hintInline: {
        opacity: 0.75,
        fontSize: 13,
        padding: "6px 2px",
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

    metaLine: {
        opacity: 0.9,
        fontSize: 13,
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
    },

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

    itemCover: {
        width: 44,
        height: 44,
        borderRadius: 12,
        overflow: "hidden",
        background: "#2a2a2a",
        flex: "0 0 auto",
    },
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