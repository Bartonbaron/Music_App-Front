// src/pages/playlist/PlaylistPage.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, Play } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useLibrary } from "../../contexts/LibraryContext";
import { mapSongToPlayerItem } from "../../utils/playerAdapter";

function formatTrackDuration(sec) {
    const s = Number(sec);
    if (!Number.isFinite(s) || s <= 0) return "—";
    const total = Math.floor(s);
    const m = Math.floor(total / 60);
    const r = total % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
}

function formatTotalDuration(sec) {
    const s = Number(sec);
    if (!Number.isFinite(s) || s <= 0) return "—";
    const total = Math.floor(s);

    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);

    if (h > 0) return `${h} godz ${m} min`;
    return `${m} min`;
}

function formatFullDate(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;

    return d.toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

export default function PlaylistPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const { token, user } = useAuth();
    const { setNewQueue } = usePlayer();
    const { playlists: libraryPlaylists, togglePlaylistInLibrary, refetch } = useLibrary();

    const [playlist, setPlaylist] = useState(null);
    const [items, setItems] = useState([]); // [{ position, song: {...} }]
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");
    const [saving, setSaving] = useState(false);

    const [toast, setToast] = useState(null);
    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1400);
    }, []);

    useEffect(() => {
        if (!token) return;

        let alive = true;

        const fetchPlaylist = async () => {
            const res = await fetch(`http://localhost:3000/api/playlists/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Failed to fetch playlist");
            return data;
        };

        const fetchSongs = async () => {
            const res = await fetch(`http://localhost:3000/api/playlists/${id}/songs`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Failed to fetch playlist songs");
            return Array.isArray(data) ? data : [];
        };

        (async () => {
            setLoading(true);
            setMsg("");
            try {
                const [p, s] = await Promise.all([fetchPlaylist(), fetchSongs()]);
                if (!alive) return;
                setPlaylist(p);
                setItems(s);
            } catch (e) {
                if (!alive) return;
                setMsg(e?.message || "Error");
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [id, token]);

    const isInLibrary = useMemo(() => {
        return (libraryPlaylists || []).some((p) => String(p.playlistID) === String(id));
    }, [libraryPlaylists, id]);

    const playlistCover = playlist?.signedCover || null;
    const playlistOwner = playlist?.user?.userName || playlist?.creatorName || null;

    // owner check: playlist.userID OR playlist.user.userID vs logged user
    const isOwner = useMemo(() => {
        const ownerId = playlist?.userID ?? playlist?.user?.userID ?? null;
        const myId = user?.userID ?? user?.id ?? null; // zależy jak masz w AuthContext
        if (!ownerId || !myId) return false;
        return String(ownerId) === String(myId);
    }, [playlist, user]);

    const createdAtLabel = useMemo(() => formatFullDate(playlist?.createdAt), [playlist?.createdAt]);

    const sortedItems = useMemo(() => {
        return (items || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    }, [items]);

    // NIE dziedziczymy okładki playlisty na utwory (zgodnie z Twoją prośbą)
    const queueItems = useMemo(() => {
        return sortedItems
            .map((row) => {
                const s = row.song || {};
                const mapped = mapSongToPlayerItem(s);

                return {
                    ...mapped,
                    signedCover: mapped.signedCover, // bez playlistCover fallback
                    creatorName:
                        s.creatorName ||
                        s?.creator?.user?.userName ||
                        mapped.creatorName ||
                        mapped.artistName ||
                        playlistOwner ||
                        null,
                    songName: s.songName ?? mapped.title,
                    songID: s.songID ?? mapped.songID,
                    _position: row.position,
                };
            })
            .filter((x) => !!x.signedAudio);
    }, [sortedItems, playlistOwner]);

    const queueIndexBySongId = useMemo(() => {
        const m = new Map();
        queueItems.forEach((q, i) => m.set(String(q.songID), i));
        return m;
    }, [queueItems]);

    const totalDuration = useMemo(() => {
        return sortedItems.reduce((acc, row) => {
            const d = Number(row?.song?.duration);
            return acc + (Number.isFinite(d) ? d : 0);
        }, 0);
    }, [sortedItems]);

    const playPlaylist = useCallback(() => {
        if (!queueItems.length) return;
        setNewQueue(queueItems, 0);
    }, [queueItems, setNewQueue]);

    const toggleLibrary = useCallback(async () => {
        if (!token) return;
        if (!togglePlaylistInLibrary) {
            showToast("Brak togglePlaylistInLibrary w LibraryContext", "error");
            return;
        }

        setSaving(true);
        try {
            const result = await togglePlaylistInLibrary(id, isInLibrary);

            if (result?.success) {
                showToast(isInLibrary ? "Usunięto z biblioteki" : "Dodano do biblioteki", "success");
            } else {
                showToast(result?.message || "Błąd biblioteki", "error");
            }
        } catch (e) {
            showToast(e?.message || "Błąd biblioteki", "error");
        } finally {
            setSaving(false);
        }
    }, [token, togglePlaylistInLibrary, id, isInLibrary, showToast]);

    const handleDeletePlaylist = useCallback(async () => {
        if (!token) return;

        const ok = window.confirm("Na pewno usunąć playlistę? Tej akcji nie da się cofnąć.");
        if (!ok) return;

        setSaving(true);
        try {
            const res = await fetch(`http://localhost:3000/api/playlists/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Delete failed");

            showToast("Playlista usunięta", "success");

            // odśwież sidebar
            await refetch?.();

            // wyjdź z widoku usuniętej playlisty
            navigate("/home");
        } catch (e) {
            showToast(e?.message || "Błąd usuwania", "error");
        } finally {
            setSaving(false);
        }
    }, [token, id, refetch, navigate, showToast]);

    if (loading) return <div style={styles.page}>Ładowanie…</div>;
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

            {/* HEADER */}
            <div style={styles.header}>
                <div style={styles.coverWrap}>
                    {playlistCover ? <img src={playlistCover} alt="cover" style={styles.coverImg} /> : null}
                </div>

                <div style={{ minWidth: 0 }}>
                    <div style={styles.kicker}>PLAYLISTA</div>

                    <h2 style={styles.h2}>{playlist?.playlistName || "Playlista"}</h2>

                    {playlist?.description ? <div style={styles.desc}>{playlist.description}</div> : null}

                    <div style={styles.metaLine}>
                        {playlistOwner ? <span>{playlistOwner}</span> : <span style={{ opacity: 0.65 }}>—</span>}

                        {createdAtLabel ? (
                            <>
                                <span style={{ opacity: 0.65 }}> • </span>
                                <span style={{ opacity: 0.85 }}>{createdAtLabel}</span>
                            </>
                        ) : null}

                        <span style={{ opacity: 0.65 }}> • </span>
                        <span style={{ opacity: 0.85 }}>{sortedItems.length} utworów</span>

                        <span style={{ opacity: 0.65 }}> • </span>
                        <span style={{ opacity: 0.85 }}>{formatTotalDuration(totalDuration)}</span>
                    </div>

                    <div style={styles.actions}>
                        <button
                            onClick={playPlaylist}
                            disabled={!queueItems.length}
                            style={{
                                ...styles.primaryBtn,
                                opacity: queueItems.length ? 1 : 0.6,
                                cursor: queueItems.length ? "pointer" : "not-allowed",
                            }}
                            title="Odtwórz playlistę"
                        >
                            <Play size={16} style={{ display: "block" }} /> Odtwórz
                        </button>

                        {/* Właściciel: usuń playlistę z bazy. Inni: toggle biblioteki */}
                        {isOwner ? (
                            <button
                                onClick={handleDeletePlaylist}
                                disabled={saving}
                                style={{
                                    ...styles.ghostBtn,
                                    opacity: saving ? 0.6 : 1,
                                    cursor: saving ? "not-allowed" : "pointer",
                                    borderColor: "#5a2a2a",
                                }}
                                title="Usuń playlistę"
                            >
                                <Trash2 size={16} style={{ display: "block" }} /> Usuń
                            </button>
                        ) : (
                            <button
                                onClick={toggleLibrary}
                                disabled={saving}
                                style={{
                                    ...styles.ghostBtn,
                                    opacity: saving ? 0.6 : 1,
                                    cursor: saving ? "not-allowed" : "pointer",
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
                        )}
                    </div>
                </div>
            </div>

            {/* TRACKLIST */}
            <div style={styles.list}>
                {sortedItems.map((row, idx) => {
                    const s = row.song || {};
                    const queueIdx = queueIndexBySongId.get(String(s.songID));
                    const playable = queueIdx != null;

                    const artist = s.creatorName || s?.creator?.user?.userName || playlistOwner || "—";

                    return (
                        <div key={row.playlistSongID || `${s.songID}-${row.position}`} style={styles.row}>
                            <button
                                onClick={() => setNewQueue(queueItems, queueIdx ?? 0)}
                                disabled={!playable}
                                style={{
                                    ...styles.rowPlayBtn,
                                    opacity: playable ? 1 : 0.45,
                                    cursor: playable ? "pointer" : "not-allowed",
                                }}
                                title="Odtwórz od tego"
                            >
                                ▶
                            </button>

                            <div style={styles.trackNo}>{row.position ?? idx + 1}.</div>

                            <div style={styles.trackMain}>
                                <div style={styles.trackTitle}>{s.songName || "Utwór"}</div>
                                <div style={styles.trackSub}>{artist}</div>
                            </div>

                            <div style={styles.trackTime}>{formatTrackDuration(s.duration)}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const styles = {
    page: { padding: 20, color: "white", paddingBottom: 120 },

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

    desc: { fontSize: 13, opacity: 0.85, marginBottom: 6, maxWidth: 720 },

    metaLine: { opacity: 0.85, fontSize: 13 },

    actions: { marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" },

    primaryBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
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
        justifyContent: "center",
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
        padding: 0,
    },

    trackNo: { opacity: 0.7, textAlign: "right" },

    trackMain: { minWidth: 0 },
    trackTitle: { fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    trackSub: { fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    trackTime: { opacity: 0.75, fontSize: 12, textAlign: "right" },
};
