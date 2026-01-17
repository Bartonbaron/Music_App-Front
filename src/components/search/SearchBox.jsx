import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Loader2, Music, Mic2, Album,
    ListMusic, User as UserIcon, Users as UsersIcon, Play } from "lucide-react";

import { apiFetch } from "../../api/http.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { usePlayer } from "../../contexts/PlayerContext.jsx";
import { mapSongToPlayerItem, mapPodcastToPlayerItem } from "../../utils/playerAdapter.js";

// Helpers
const FILTERS = [
    { key: "all", label: "Wszystko" },
    { key: "song", label: "Utwory" },
    { key: "podcast", label: "Podcasty" },
    { key: "album", label: "Albumy" },
    { key: "playlist", label: "Playlisty" },
    { key: "user", label: "Użytkownicy" },
    { key: "creator", label: "Twórcy" },
];

function getTypeLabel(type) {
    switch (type) {
        case "song":
            return "Utwór";
        case "podcast":
            return "Podcast";
        case "album":
            return "Album";
        case "playlist":
            return "Playlista";
        case "user":
            return "Użytkownik";
        case "creator":
            return "Twórca";
        default:
            return type;
    }
}

function getFallbackIcon(type) {
    switch (type) {
        case "song":
            return <Music size={18} style={{ display: "block", opacity: 0.85 }} />;
        case "podcast":
            return <Mic2 size={18} style={{ display: "block", opacity: 0.85 }} />;
        case "album":
            return <Album size={18} style={{ display: "block", opacity: 0.85 }} />;
        case "playlist":
            return <ListMusic size={18} style={{ display: "block", opacity: 0.85 }} />;
        case "creator":
            return <UsersIcon size={18} style={{ display: "block", opacity: 0.85 }} />;
        case "user":
        default:
            return <UserIcon size={18} style={{ display: "block", opacity: 0.85 }} />;
    }
}

function mapSearchToUi(res) {
    const out = [];

    (res?.songs || []).forEach((s) => {
        out.push({
            type: "song",
            id: s.songID ?? s.id,
            title: s.songName || "Utwór",
            subtitle: s.creatorName || s?.creator?.user?.userName || "",
            signedCover: s.signedCover || s.effectiveCover || null,
            signedAudio: s.signedAudio || null,
            raw: s,
        });
    });

    (res?.podcasts || []).forEach((p) => {
        out.push({
            type: "podcast",
            id: p.podcastID ?? p.id,
            title: p.podcastName || p.title || "Podcast",
            subtitle: p.creatorName || p?.creator?.user?.userName || "",
            signedCover: p.signedCover || null,
            signedAudio: p.signedAudio || null,
            raw: p,
        });
    });

    (res?.albums || []).forEach((a) => {
        out.push({
            type: "album",
            id: a.albumID ?? a.id,
            title: a.albumName || "Album",
            subtitle: a.creatorName || a?.creator?.user?.userName || "",
            signedCover: a.signedCover || null,
            raw: a,
        });
    });

    (res?.playlists || []).forEach((p) => {
        out.push({
            type: "playlist",
            id: p.playlistID ?? p.id,
            title: p.playlistName || "Playlista",
            subtitle: p.creatorName || p?.user?.userName || "",
            signedCover: p.signedCover || null,
            raw: p,
        });
    });

    (res?.users || []).forEach((u) => {
        out.push({
            type: "user",
            id: u.userID ?? u.id,
            title: u.userName || "Użytkownik",
            subtitle: "Profil użytkownika",
            signedProfilePicURL: u.signedProfilePicURL || null,
            raw: u,
        });
    });

    (res?.creators || []).forEach((c) => {
        const u = c?.user || null;
        out.push({
            type: "creator",
            id: c.creatorID ?? c.id,
            userID: u?.userID ?? null,
            title: u?.userName || "Twórca",
            subtitle: "Profil twórcy",
            signedProfilePicURL: u?.signedProfilePicURL || null,
            raw: c,
        });
    });

    return out.filter((x) => x.id != null);
}

export function SearchBox() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const { setNewQueue } = usePlayer();

    const [q, setQ] = useState("");
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState("all");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [results, setResults] = useState([]);

    const abortRef = useRef(null);
    const wrapRef = useRef(null);
    const inputRef = useRef(null);

    // zamykanie po kliknięciu poza
    useEffect(() => {
        if (!open) return;

        const onDown = (e) => {
            const t = e.target;
            if (wrapRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    // abort na unmount (żeby nie było setState po unmount)
    useEffect(() => {
        return () => {
            try {
                abortRef.current?.abort();
                // eslint-disable-next-line no-unused-vars
            } catch (_) {
                /* noop */
            }
        };
    }, []);

    const shown = useMemo(() => {
        const base = results || [];
        if (filter === "all") return base;
        return base.filter((x) => x.type === filter);
    }, [results, filter]);

    const clear = useCallback(() => {
        setQ("");
        setResults([]);
        setError("");
        setLoading(false);
        setOpen(false);
        setFilter("all");
        inputRef.current?.focus?.();
    }, []);

    // debounce + abort
    useEffect(() => {
        if (!token) return;

        const qq = q.trim();
        if (qq.length < 2) {
            setResults([]);
            setError("");
            setLoading(false);
            return;
        }

        const t = window.setTimeout(async () => {
            try {
                abortRef.current?.abort();
                // eslint-disable-next-line no-unused-vars
            } catch (_) {
                /* empty */
            }

            const ac = new AbortController();
            abortRef.current = ac;

            setLoading(true);
            setError("");

            try {
                const res = await apiFetch(`/search?q=${encodeURIComponent(qq)}`, {
                    token,
                    signal: ac.signal,
                });

                setResults(mapSearchToUi(res));
                setOpen(true);
            } catch (e) {
                if (e?.name === "AbortError") return;
                setError(e?.message || "Błąd wyszukiwania");
                setResults([]);
                setOpen(true);
            } finally {
                setLoading(false);
            }
        }, 250);

        return () => window.clearTimeout(t);
    }, [q, token]);

    const openDetails = useCallback(
        (item) => {
            if (!item) return;
            setOpen(false);

            if (item.type === "song") navigate(`/songs/${item.id}`);
            else if (item.type === "podcast") navigate(`/podcasts/${item.id}`);
            else if (item.type === "album") navigate(`/albums/${item.id}`);
            else if (item.type === "playlist") navigate(`/playlists/${item.id}`);
            else if (item.type === "user") navigate(`/users/${item.id}`);
            else if (item.type === "creator") navigate(`/creators/${item.id}`);
        },
        [navigate]
    );

    const playFromCover = useCallback(
        (item) => {
            if (!item) return;

            if ((item.type === "song" || item.type === "podcast") && !item.signedAudio) {
                openDetails(item);
                return;
            }

            if (item.type === "song") {
                const playerItem = mapSongToPlayerItem({
                    ...(item.raw || {}),
                    songID: item.id,
                    songName: item.title,
                    title: item.title,
                    creatorName: item.subtitle,
                    signedAudio: item.signedAudio,
                    signedCover: item.signedCover,
                    fileURL: item.signedAudio || item.raw?.fileURL || null,
                    coverURL: item.signedCover || item.raw?.coverURL || null,
                });

                setNewQueue([playerItem], 0);
                setOpen(false);
                return;
            }

            if (item.type === "podcast") {
                const playerItem = mapPodcastToPlayerItem({
                    ...(item.raw || {}),
                    podcastID: item.id,
                    podcastName: item.title,
                    title: item.title,
                    creatorName: item.subtitle,
                    signedAudio: item.signedAudio,
                    signedCover: item.signedCover,
                    fileURL: item.signedAudio || item.raw?.fileURL || null,
                    coverURL: item.signedCover || item.raw?.coverURL || null,
                });

                setNewQueue([playerItem], 0);
                setOpen(false);
                return;
            }

            openDetails(item);
        },
        [setNewQueue, openDetails]
    );

    const hasQuery = q.trim().length >= 2;

    return (
        <div ref={wrapRef} style={sx.wrap}>
            <div style={sx.inputWrap}>
                <Search size={16} style={{ display: "block", opacity: 0.75 }} />
                <input
                    ref={inputRef}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onFocus={() => {
                        if (hasQuery) setOpen(true);
                    }}
                    placeholder="Czego chciałbyś posłuchać?"
                    style={sx.input}
                />

                {loading ? (
                    <Loader2
                        size={16}
                        style={{
                            display: "block",
                            opacity: 0.8,
                            animation: "spin 1s linear infinite",
                        }}
                    />
                ) : q ? (
                    <button type="button" onClick={clear} style={sx.clearBtn} title="Wyczyść">
                        <X size={16} style={{ display: "block" }} />
                    </button>
                ) : null}
            </div>

            {open ? (
                <div style={sx.drop}>
                    {/* FILTER PILLS */}
                    <div style={sx.pillsRow}>
                        {FILTERS.map((f) => {
                            const active = filter === f.key;
                            return (
                                <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => setFilter(f.key)}
                                    style={{
                                        ...sx.pill,
                                        background: active ? "#1db954" : "#141414",
                                        color: active ? "#000" : "#fff",
                                        borderColor: active ? "#1db954" : "#2a2a2a",
                                    }}
                                    title={`Filtr: ${f.label}`}
                                >
                                    {f.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* STATES */}
                    {error ? <div style={sx.stateBox}>{error}</div> : null}

                    {!error && !loading && shown.length === 0 && hasQuery ? (
                        <div style={sx.stateBox}>Brak wyników.</div>
                    ) : null}

                    {/* LIST */}
                    {shown.length > 0 ? (
                        <div style={sx.list}>
                            {shown.map((it) => {
                                const cover =
                                    it.type === "user" || it.type === "creator"
                                        ? it.signedProfilePicURL || null
                                        : it.signedCover || null;

                                const canPlay = (it.type === "song" || it.type === "podcast") && !!it.signedAudio;
                                const typeLabel = getTypeLabel(it.type);

                                return (
                                    <div key={`${it.type}-${it.id}`} style={sx.row}>
                                        {/* COVER -> PLAY (song/podcast) */}
                                        <button
                                            type="button"
                                            onClick={() => playFromCover(it)}
                                            style={sx.coverBtn}
                                            title={canPlay ? "Odtwórz" : "Otwórz"}
                                        >
                                            {cover ? (
                                                <img
                                                    src={cover}
                                                    alt=""
                                                    style={sx.coverImg}
                                                    referrerPolicy="no-referrer"
                                                    crossOrigin="anonymous"
                                                    onError={(e) => {
                                                        e.currentTarget.onerror = null;
                                                        e.currentTarget.src = "";
                                                    }}
                                                />
                                            ) : (
                                                <div style={sx.coverPh}>{getFallbackIcon(it.type)}</div>
                                            )}

                                            {canPlay ? (
                                                <div style={sx.playOverlay}>
                                                    <Play size={16} style={{ display: "block" }} />
                                                </div>
                                            ) : null}
                                        </button>

                                        {/* TEXT */}
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <button type="button" onClick={() => openDetails(it)} style={sx.titleBtn} title={it.title}>
                                                {it.title}
                                            </button>

                                            <div style={sx.subRow}>
                                            <span style={sx.badge} title={typeLabel}>
                                                {typeLabel}
                                            </span>

                                                {it.subtitle ? (
                                                    <span style={sx.subText} title={it.subtitle}>
                                                        {it.subtitle}
                                                    </span>
                                                ) : (
                                                    <span style={{ opacity: 0.55, fontSize: 12 }}>—</span>
                                                )}
                                            </div>
                                        </div>

                                        <button type="button" onClick={() => openDetails(it)} style={sx.openBtn} title="Szczegóły">
                                            Otwórz
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
            ) : null}

            {/* keyframes dla Loader2 */}
            <style>{`
        @keyframes spin { 
          from { transform: rotate(0deg); } 
          to { transform: rotate(360deg); } 
        }
      `}</style>
        </div>
    );
}

const sx = {
    wrap: { position: "relative", width: "min(720px, 55vw)" },

    inputWrap: {
        height: 38,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 12px",
        borderRadius: 999,
        border: "1px solid #2a2a2a",
        background: "#1a1a1a",
    },

    input: {
        flex: 1,
        height: "100%",
        background: "transparent",
        border: "none",
        outline: "none",
        color: "white",
        fontWeight: 700,
    },

    clearBtn: {
        width: 28,
        height: 28,
        borderRadius: 999,
        border: "1px solid #2a2a2a",
        background: "#141414",
        color: "white",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
    },

    drop: {
        position: "absolute",
        top: 44,
        left: 0,
        right: 0,
        background: "#121212",
        border: "1px solid #2a2a2a",
        borderRadius: 14,
        boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
        overflow: "hidden",
        zIndex: 60,
    },

    pillsRow: {
        display: "flex",
        gap: 8,
        padding: 10,
        borderBottom: "1px solid #2a2a2a",
        flexWrap: "wrap",
        background: "#0f0f0f",
    },

    pill: {
        borderRadius: 999,
        border: "1px solid #2a2a2a",
        padding: "7px 10px",
        fontWeight: 900,
        fontSize: 12,
        cursor: "pointer",
    },

    stateBox: {
        padding: 12,
        opacity: 0.85,
        fontSize: 13,
        borderBottom: "1px solid #2a2a2a",
    },

    list: { display: "flex", flexDirection: "column" },

    row: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderBottom: "1px solid #1e1e1e",
    },

    coverBtn: {
        width: 46,
        height: 46,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #2a2a2a",
        background: "#141414",
        padding: 0,
        position: "relative",
        cursor: "pointer",
        flex: "0 0 auto",
    },

    coverImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
    coverPh: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#141414",
    },

    playOverlay: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: 26,
        height: 26,
        borderRadius: 999,
        background: "rgba(0,0,0,0.55)",
        border: "1px solid rgba(255,255,255,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
    },

    titleBtn: {
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "transparent",
        border: "none",
        color: "white",
        fontWeight: 900,
        cursor: "pointer",
        padding: 0,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },

    subRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 4, minWidth: 0 },

    badge: {
        fontSize: 11,
        fontWeight: 900,
        padding: "3px 8px",
        borderRadius: 999,
        border: "1px solid #2a2a2a",
        background: "#141414",
        opacity: 0.9,
        flex: "0 0 auto",
    },

    subText: {
        fontSize: 12,
        opacity: 0.75,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        minWidth: 0,
    },

    openBtn: {
        flex: "0 0 auto",
        borderRadius: 999,
        border: "1px solid #2a2a2a",
        background: "#1a1a1a",
        color: "white",
        fontWeight: 900,
        padding: "8px 12px",
        cursor: "pointer",
    },
};