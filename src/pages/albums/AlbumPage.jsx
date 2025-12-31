import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { Plus, Trash2, Play } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useLibrary } from "../../contexts/LibraryContext";
import { mapSongToPlayerItem } from "../../utils/playerAdapter";

function formatDuration(sec) {
    const s = Number(sec);
    if (!Number.isFinite(s) || s <= 0) return "—";
    const total = Math.floor(s);
    const m = Math.floor(total / 60);
    const r = total % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
}

function formatTotalDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "—";
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);

    if (h > 0) return `${h} h ${m} min`;
    return `${m} min`;
}

function formatFullDate(value) {
    if (!value) return null;

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;

    // pełna data: dd.mm.rrrr
    return d.toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

export default function AlbumPage() {
    const { id } = useParams();
    const { token } = useAuth();
    const { setNewQueue } = usePlayer();
    const { albums: libraryAlbums, toggleAlbumInLibrary } = useLibrary();

    const [album, setAlbum] = useState(null);
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);

    // msg zostawiamy jako "banner error" na stronie (nie jako osobny ekran)
    const [msg, setMsg] = useState("");

    const [savingLibrary, setSavingLibrary] = useState(false);

    // toast
    const [toast, setToast] = useState(null); // { text, type: "success" | "error" }
    const toastTimerRef = useRef(null);

    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 1500);
    }, []);

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (!token) return;

        let alive = true;

        const fetchAlbum = async () => {
            const res = await fetch(`http://localhost:3000/api/albums/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Failed to fetch album");
            return data;
        };

        const fetchSongs = async () => {
            const res = await fetch(`http://localhost:3000/api/albums/${id}/songs`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Failed to fetch album songs");
            return data.songs ?? [];
        };

        (async () => {
            setLoading(true);
            setMsg("");
            try {
                const [a, s] = await Promise.all([fetchAlbum(), fetchSongs()]);
                if (!alive) return;
                setAlbum(a);
                setSongs(s);
            } catch (e) {
                if (!alive) return;
                setMsg(e.message || "Error");
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [id, token]);

    const isInLibrary = useMemo(() => {
        return (libraryAlbums || []).some((a) => String(a.albumID) === String(id));
    }, [libraryAlbums, id]);

    const albumCover = album?.signedCover || null;
    const albumArtist = album?.creator?.user?.userName || album?.creatorName || null;

    const releaseDateLabel = useMemo(() => {
        // preferuj releaseDate, fallback na createdAt
        return formatFullDate(album?.releaseDate || album?.createdAt);
    }, [album?.releaseDate, album?.createdAt]);

    const queueItems = useMemo(() => {
        return (songs || [])
            .map((s) => {
                const item = mapSongToPlayerItem(s);
                return {
                    ...item,
                    // preferuj okładkę albumu
                    signedCover: albumCover || item.signedCover,
                    // preferuj autora albumu
                    creatorName: albumArtist || item.creatorName || item.artistName || null,
                    songName: s.songName ?? item.title,
                };
            })
            .filter((x) => !!x.signedAudio);
    }, [songs, albumCover, albumArtist]);

    const albumDuration = useMemo(() => {
        return (songs || []).reduce((sum, s) => {
            const d = Number(s.duration);
            return Number.isFinite(d) ? sum + d : sum;
        }, 0);
    }, [songs]);

    const playAlbum = useCallback(() => {
        if (!queueItems.length) return;
        setNewQueue(queueItems, 0);
    }, [queueItems, setNewQueue]);

    const toggleLibrary = useCallback(async () => {
        if (!token) return;

        setSavingLibrary(true);
        setMsg("");

        try {
            const result = await toggleAlbumInLibrary(id, isInLibrary);

            if (result?.success) {
                showToast(isInLibrary ? "Usunięto z biblioteki" : "Dodano do biblioteki", "success");
            } else {
                showToast(result?.message || "Błąd biblioteki", "error");
            }
        } catch (e) {
            showToast(e?.message || "Błąd biblioteki", "error");
        } finally {
            setSavingLibrary(false);
        }
    }, [token, toggleAlbumInLibrary, id, isInLibrary, showToast]);

    if (loading) return <div style={styles.page}>Ładowanie…</div>;

    return (
        <div style={styles.page}>
            {msg ? <div style={styles.errorBanner}>{msg}</div> : null}

            {/* HEADER */}
            <div style={styles.header}>
                <div style={styles.coverWrap}>
                    {albumCover ? <img src={albumCover} alt="cover" style={styles.coverImg} /> : null}
                </div>

                <div style={{ minWidth: 0 }}>
                    <div style={styles.kicker}>ALBUM</div>
                    <h2 style={styles.h2}>{album?.albumName || "Album"}</h2>

                    <div style={styles.metaLine}>
                        {albumArtist ? <span>{albumArtist}</span> : <span style={{ opacity: 0.65 }}>—</span>}

                        {releaseDateLabel ? (
                            <>
                                <span style={{ opacity: 0.65 }}> • </span>
                                <span style={{ opacity: 0.85 }}>{releaseDateLabel}</span>
                            </>
                        ) : null}

                        <span style={{ opacity: 0.65 }}> • </span>
                        <span style={{ opacity: 0.85 }}>{songs.length} utworów</span>

                        <span style={{ opacity: 0.65 }}> • </span>
                        <span style={{ opacity: 0.85 }}>{formatTotalDuration(albumDuration)}</span>
                    </div>

                    <div style={styles.actions}>
                        <button
                            onClick={playAlbum}
                            disabled={!queueItems.length}
                            style={{
                                ...styles.primaryBtn,
                                opacity: queueItems.length ? 1 : 0.6,
                                cursor: queueItems.length ? "pointer" : "not-allowed",
                            }}
                            title="Odtwórz album"
                        >
                            <Play size={16} style={{ display: "block" }} /> Odtwórz
                        </button>

                        <button
                            onClick={toggleLibrary}
                            disabled={savingLibrary}
                            style={{
                                ...styles.ghostBtn,
                                opacity: savingLibrary ? 0.6 : 1,
                                cursor: savingLibrary ? "not-allowed" : "pointer",
                            }}
                            title={isInLibrary ? "Usuń z biblioteki" : "Dodaj do biblioteki"}
                        >
                            {isInLibrary ? (
                                <>
                                    <Trash2 size={16} style={{ display: "block" }} /> Usuń z biblioteki
                                </>
                            ) : (
                                <>
                                    <Plus size={16} style={{ display: "block" }} /> Dodaj do biblioteki
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* TRACKLIST */}
            <div style={styles.list}>
                {songs.map((s, idx) => {
                    const playable = !!queueItems[idx]?.signedAudio;

                    return (
                        <div key={s.songID} style={styles.row}>
                            <button
                                onClick={() => setNewQueue(queueItems, idx)}
                                disabled={!playable}
                                style={{
                                    ...styles.rowPlayBtn,
                                    opacity: playable ? 1 : 0.45,
                                    cursor: playable ? "pointer" : "not-allowed",
                                }}
                                title="Odtwórz od tego"
                            >
                                <Play size={14} />
                            </button>

                            <div style={styles.trackNo}>{s.trackNumber ?? idx + 1}.</div>

                            <div style={styles.trackMain}>
                                <div style={styles.trackTitle}>{s.songName}</div>
                                <div style={styles.trackSub}>{albumArtist || "—"}</div>
                            </div>

                            <div style={styles.trackTime}>{formatDuration(s.duration)}</div>
                        </div>
                    );
                })}
            </div>

            {/* TOAST */}
            {toast && (
                <div
                    style={{
                        position: "fixed",
                        bottom: 110, // nad PlayerBar
                        left: "50%",
                        transform: "translateX(-50%)",
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: toast.type === "error" ? "#b3261e" : "#1db954",
                        color: toast.type === "error" ? "#fff" : "#000",
                        fontWeight: 800,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                        zIndex: 200,
                        pointerEvents: "none",
                    }}
                >
                    {toast.text}
                </div>
            )}
        </div>
    );
}

const styles = {
    page: { padding: 20, color: "white", paddingBottom: 120 },

    errorBanner: {
        background: "#2a1a1a",
        border: "1px solid #5a2a2a",
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
        opacity: 0.95,
    },

    header: { display: "flex", gap: 16, alignItems: "center" },

    coverWrap: {
        width: 140,
        height: 140,
        borderRadius: 12,
        overflow: "hidden",
        background: "#2a2a2a",
        flex: "0 0 auto",
    },
    coverImg: { width: "100%", height: "100%", objectFit: "cover" },

    kicker: { opacity: 0.7, fontSize: 12, letterSpacing: 1 },
    h2: { margin: "6px 0 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    metaLine: { opacity: 0.85, fontSize: 13 },

    actions: { marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" },

    primaryBtn: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        border: "none",
        background: "#1db954",
        color: "#000",
        fontWeight: 900,
    },

    ghostBtn: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #333",
        background: "transparent",
        color: "white",
        fontWeight: 800,
    },

    list: { marginTop: 18 },

    row: {
        display: "grid",
        gridTemplateColumns: "44px 40px 1fr 60px",
        gap: 12,
        alignItems: "center",
        padding: "10px 8px",
        borderBottom: "1px solid #2a2a2a",
    },

    rowPlayBtn: {
        width: 38,
        height: 34,
        borderRadius: 10,
        border: "1px solid #333",
        background: "transparent",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    trackNo: { opacity: 0.7, textAlign: "right" },

    trackMain: { minWidth: 0 },
    trackTitle: { fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    trackSub: { fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    trackTime: { opacity: 0.75, fontSize: 12, textAlign: "right" },
};
