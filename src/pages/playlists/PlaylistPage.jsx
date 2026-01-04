import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

function pickSongCover(song) {
    // preferuj album cover jeśli jest
    return (
        song?.album?.signedCover ||
        song?.album?.coverURL ||
        song?.signedCover ||
        song?.coverURL ||
        null
    );
}

export default function PlaylistPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const { setNewQueue } = usePlayer();
    const { playlists: libraryPlaylists, togglePlaylistInLibrary, refetch } = useLibrary();

    const [playlist, setPlaylist] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");

    const [savingLibrary, setSavingLibrary] = useState(false);
    const [toast, setToast] = useState(null);

    // modale
    const [addOpen, setAddOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeSong, setActiveSong] = useState(null); // { songID, title }

    const [menuBusy, setMenuBusy] = useState(false);

    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1400);
    }, []);

    const fetchSongsOnly = useCallback(async () => {
        if (!token) return;
        const res = await fetch(`http://localhost:3000/api/playlists/${id}/songs`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Failed to fetch playlist songs");
        setItems(Array.isArray(data) ? data : []);
    }, [id, token]);

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
                setItems(Array.isArray(s) ? s : []);
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

    const meId = useMemo(() => String(user?.userID ?? user?.id ?? ""), [user]);
    const playlistOwnerId = useMemo(() => String(playlist?.userID ?? ""), [playlist]);

    const isOwner = useMemo(() => {
        if (!meId || !playlistOwnerId) return false;
        return meId === playlistOwnerId;
    }, [meId, playlistOwnerId]);

    const canEdit = useMemo(() => {
        if (!playlist) return false;
        return isOwner || Boolean(playlist?.isCollaborative);
    }, [playlist, isOwner]);

    const isInLibrary = useMemo(() => {
        return (libraryPlaylists || []).some((p) => String(p.playlistID) === String(id));
    }, [libraryPlaylists, id]);

    const playlistCover = playlist?.signedCover || null;
    const playlistOwner = playlist?.user?.userName || playlist?.creatorName || null;
    const createdAtLabel = useMemo(() => formatFullDate(playlist?.createdAt), [playlist?.createdAt]);

    const sortedItems = useMemo(() => {
        return (items || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    }, [items]);

    const queueItems = useMemo(() => {
        return sortedItems
            .map((row) => {
                const s = row.song || {};
                const mapped = mapSongToPlayerItem(s);

                return {
                    ...mapped,
                    type: "song",
                    signedCover: mapped.signedCover,
                    creatorName:
                        s.creatorName ||
                        s?.creator?.user?.userName ||
                        playlistOwner ||
                        mapped.creatorName ||
                        mapped.artistName ||
                        null,
                    songName: s.songName ?? mapped.title,
                    songID: s.songID ?? mapped.songID,
                    duration: s.duration ?? mapped.duration,
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

    const toggleLibraryOrDeletePlaylist = useCallback(async () => {
        if (!token) return;

        // owner -> usuń całą playlistę
        if (isOwner) {
            const ok = window.confirm("Na pewno usunąć playlistę? Tej operacji nie da się cofnąć.");
            if (!ok) return;

            setSavingLibrary(true);
            try {
                const res = await fetch(`http://localhost:3000/api/playlists/${id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                });

                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    showToast(data?.message || "Nie udało się usunąć playlisty", "error");
                    return;
                }

                showToast("Usunięto playlistę", "success");
                await refetch?.();
                navigate("/", { replace: true });
            } catch (e) {
                showToast(e?.message || "Błąd usuwania", "error");
            } finally {
                setSavingLibrary(false);
            }
            return;
        }

        // nie owner -> dodaj/usuń z biblioteki
        if (!togglePlaylistInLibrary) {
            showToast("Brak togglePlaylistInLibrary w LibraryContext", "error");
            return;
        }

        setSavingLibrary(true);
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
            setSavingLibrary(false);
        }
    }, [token, isOwner, id, isInLibrary, togglePlaylistInLibrary, showToast, refetch, navigate]);

    const openSongMenu = useCallback((songID, title) => {
        setActiveSong({ songID, title });
        setMenuOpen(true);
    }, []);

    const removeFromThisPlaylist = useCallback(async () => {
        if (!token || !activeSong?.songID) return;

        const ok = window.confirm("Usunąć ten utwór z tej playlisty?");
        if (!ok) return;

        setMenuBusy(true);
        try {
            const res = await fetch(
                `http://localhost:3000/api/playlists/${id}/songs/${activeSong.songID}`,
                {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                showToast(data?.message || "Nie udało się usunąć utworu", "error");
                return;
            }

            showToast("Usunięto z playlisty", "success");
            setMenuOpen(false);

            // odśwież tracklistę (bez przeładowywania całej strony)
            await fetchSongsOnly();
        } catch (e) {
            showToast(e?.message || "Błąd sieci", "error");
        } finally {
            setMenuBusy(false);
        }
    }, [token, activeSong, id, showToast, fetchSongsOnly]);

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

            {/* MODAL: SONG MENU */}
            <SongActionsModal
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                songTitle={activeSong?.title}
                canRemoveFromCurrent={canEdit}
                busy={menuBusy}
                onAddToPlaylist={() => {
                    setMenuOpen(false);
                    setAddOpen(true);
                }}
                onRemoveFromCurrent={removeFromThisPlaylist}
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
                            type="button"
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

                        <button
                            type="button"
                            onClick={toggleLibraryOrDeletePlaylist}
                            disabled={savingLibrary}
                            style={{
                                ...styles.ghostBtn,
                                opacity: savingLibrary ? 0.6 : 1,
                                cursor: savingLibrary ? "not-allowed" : "pointer",
                            }}
                            title={
                                isOwner
                                    ? "Usuń playlistę"
                                    : isInLibrary
                                        ? "Usuń z biblioteki"
                                        : "Dodaj do biblioteki"
                            }
                        >
                            {isOwner ? (
                                <>
                                    <Trash2 size={16} style={{ display: "block" }} /> Usuń playlistę
                                </>
                            ) : isInLibrary ? (
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
                {sortedItems.map((row, idx) => {
                    const s = row.song || {};
                    const queueIdx = queueIndexBySongId.get(String(s.songID));
                    const playable = queueIdx != null;

                    const artist = s.creatorName || s?.creator?.user?.userName || playlistOwner || "—";

                    return (
                        <div key={row.playlistSongID || `${s.songID}-${row.position}`} style={styles.row}>
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

                            {/* Mini cover (po prawej od play) */}
                            <div style={styles.miniCoverWrap}>
                                {pickSongCover(s) ? (
                                    <img src={pickSongCover(s)} alt="" style={styles.miniCoverImg} />
                                ) : (
                                    <div style={styles.miniCoverPh} />
                                )}
                            </div>

                            <div style={styles.trackNo}>{row.position ?? idx + 1}.</div>

                            <div style={styles.trackMain}>
                                <div style={styles.trackTitle} title={s.songName || "Utwór"}>
                                    {s.songName || "Utwór"}
                                </div>
                                <div style={styles.trackSub} title={artist}>
                                    {artist}
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
        gridTemplateColumns: "44px 44px 34px minmax(0, 1fr) 44px 44px 70px",
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
        lineHeight: 0,
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
        lineHeight: 0,
    },

    miniCoverWrap: {
        width: 34,
        height: 34,
        borderRadius: 8,
        overflow: "hidden",
        background: "#2a2a2a",
        border: "1px solid #2a2a2a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    miniCoverImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
    miniCoverPh: { width: "100%", height: "100%", background: "#2a2a2a" },

    trackNo: { opacity: 0.7, textAlign: "right", fontVariantNumeric: "tabular-nums" },

    trackMain: { minWidth: 0, overflow: "hidden" },
    trackTitle: { fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    trackSub: { fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    trackTime: { opacity: 0.75, fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" },
};
