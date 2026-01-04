import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Trash2, Play } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useLibrary } from "../../contexts/LibraryContext";
import { mapSongToPlayerItem } from "../../utils/playerAdapter";

import LikeButton from "../../components/common/LikeButton";
import AddToPlaylistModal from "../../components/common/AddToPlaylistModal";
import SongActionsModal from "../../components/common/SongActionsModal";
import { formatTrackDuration, formatTotalDuration } from "../../utils/time.js";

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

export default function AlbumPage() {
    const { id } = useParams();
    const { token } = useAuth();
    const { setNewQueue } = usePlayer();

    const { albums: libraryAlbums, toggleAlbumInLibrary } = useLibrary();

    const [album, setAlbum] = useState(null);
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");

    const [savingLibrary, setSavingLibrary] = useState(false);

    const [toast, setToast] = useState(null);
    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1400);
    }, []);

    // modale
    const [addOpen, setAddOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeSong, setActiveSong] = useState(null); // { songID, title }
    const [menuBusy] = useState(false);

    useEffect(() => {
        if (!token) return;

        let alive = true;

        const fetchAlbum = async () => {
            const res = await fetch(`http://localhost:3000/api/albums/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Failed to fetch album");
            return data;
        };

        const fetchSongs = async () => {
            const res = await fetch(`http://localhost:3000/api/albums/${id}/songs`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Failed to fetch album songs");
            return data.songs ?? [];
        };

        (async () => {
            setLoading(true);
            setMsg("");
            try {
                const [a, s] = await Promise.all([fetchAlbum(), fetchSongs()]);
                if (!alive) return;
                setAlbum(a);
                setSongs(Array.isArray(s) ? s : []);
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
        return (libraryAlbums || []).some((a) => String(a.albumID) === String(id));
    }, [libraryAlbums, id]);

    const albumCover = album?.signedCover || null;
    const albumArtist = album?.creator?.user?.userName || album?.creatorName || null;

    const releaseDateLabel = useMemo(() => {
        return formatFullDate(album?.releaseDate || album?.createdAt);
    }, [album?.releaseDate, album?.createdAt]);

    const sortedSongs = useMemo(() => {
        const list = Array.isArray(songs) ? songs.slice() : [];
        const hasTrackNumbers = list.some((x) => x?.trackNumber != null);
        if (!hasTrackNumbers) return list;
        return list.sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
    }, [songs]);

    const queueItems = useMemo(() => {
        return (sortedSongs || [])
            .map((s) => {
                const mapped = mapSongToPlayerItem(s);
                return {
                    ...mapped,
                    type: "song",
                    signedCover: albumCover || mapped.signedCover,
                    creatorName: albumArtist || mapped.creatorName || mapped.artistName || null,
                    songName: s.songName ?? mapped.title,
                    songID: s.songID ?? mapped.songID,
                    duration: s.duration ?? mapped.duration,
                };
            })
            .filter((x) => !!x.signedAudio);
    }, [sortedSongs, albumCover, albumArtist]);

    const queueIndexBySongId = useMemo(() => {
        const m = new Map();
        queueItems.forEach((q, i) => m.set(String(q.songID), i));
        return m;
    }, [queueItems]);

    const totalDuration = useMemo(() => {
        return (sortedSongs || []).reduce((acc, s) => {
            const d = Number(s?.duration);
            return acc + (Number.isFinite(d) ? d : 0);
        }, 0);
    }, [sortedSongs]);

    const playAlbum = useCallback(() => {
        if (!queueItems.length) return;
        setNewQueue(queueItems, 0);
    }, [queueItems, setNewQueue]);

    const toggleLibrary = useCallback(async () => {
        if (!token) return;
        if (!toggleAlbumInLibrary) {
            showToast("Brak toggleAlbumInLibrary w LibraryContext", "error");
            return;
        }

        setSavingLibrary(true);
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

    const openSongMenu = useCallback((songID, title) => {
        setActiveSong({ songID, title });
        setMenuOpen(true);
    }, []);

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

            {/* MODAL: SONG MENU (tylko Dodaj do playlisty) */}
            <SongActionsModal
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                songTitle={activeSong?.title}
                canRemoveFromCurrent={false}
                busy={menuBusy}
                onAddToPlaylist={() => {
                    setMenuOpen(false);
                    setAddOpen(true);
                }}
                onRemoveFromCurrent={null}
            />

            {/* MODAL: ADD TO PLAYLIST */}
            <AddToPlaylistModal
                open={addOpen}
                onClose={() => setAddOpen(false)}
                songID={activeSong?.songID}
                songTitle={activeSong?.title}
                onToast={showToast}
            />

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
                        <span style={{ opacity: 0.85 }}>{sortedSongs.length} utworów</span>

                        <span style={{ opacity: 0.65 }}> • </span>
                        <span style={{ opacity: 0.85 }}>{formatTotalDuration(totalDuration)}</span>
                    </div>

                    <div style={styles.actions}>
                        <button
                            type="button"
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
                            type="button"
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
                {sortedSongs.map((s, idx) => {
                    const queueIdx = queueIndexBySongId.get(String(s.songID));
                    const playable = queueIdx != null;

                    return (
                        <div key={s.songID || idx} style={styles.row}>
                            <button
                                type="button"
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

                            <div style={styles.trackNo}>{s.trackNumber ?? idx + 1}.</div>

                            <div style={styles.trackMain}>
                                <div style={styles.trackTitle} title={s.songName || "Utwór"}>
                                    {s.songName || "Utwór"}
                                </div>
                                <div style={styles.trackSub} title={albumArtist || "—"}>
                                    {albumArtist || "—"}
                                </div>
                            </div>

                            <LikeButton songID={s.songID} onToast={showToast} />

                            <button
                                type="button"
                                onClick={() => openSongMenu(s.songID, s.songName || "Utwór")}
                                style={styles.moreBtn}
                                title="Opcje"
                            >
                                ⋯
                            </button>

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
        gridTemplateColumns: "44px 40px minmax(0, 1fr) 44px 44px 60px",
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

    moreBtn: {
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
        fontWeight: 900,
        fontSize: 18,
        lineHeight: 1,
    },

    trackNo: { opacity: 0.7, textAlign: "right" },

    trackMain: { minWidth: 0 },
    trackTitle: { fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    trackSub: { fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    trackTime: { opacity: 0.75, fontSize: 12, textAlign: "right" },
};
