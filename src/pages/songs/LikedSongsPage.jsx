import { useCallback, useMemo, useState } from "react";
import { Heart, Play } from "lucide-react";

import { usePlayer } from "../../contexts/PlayerContext.jsx";
import { useLibrary } from "../../contexts/LibraryContext.jsx";
import { formatTrackDuration, formatTotalDuration } from "../../utils/time.js";
import SongActionsModal from "../../components/actions/SongActionsModal.jsx";
import { addSongToQueue } from "../../api/playback/queue.api.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import AddToPlaylistModal from "../../components/playlists/AddToPlaylistModal.jsx";

function pickSongCover(song) {
    return (
        // song?.album?.signedCover ||
        // song?.album?.coverURL ||
        song?.signedCover ||
        song?.coverURL ||
        null
    );
}

export default function LikedSongsPage() {
    const { setNewQueue } = usePlayer();
    const { favoriteSongs, loading, error, likedSongIds, toggleSongLike } = useLibrary();

    const [toast, setToast] = useState(null);
    const [likingId, setLikingId] = useState(null);
    const { token } = useAuth();

    const [menuOpen, setMenuOpen] = useState(false);
    const [activeSong, setActiveSong] = useState(null);
    const [menuBusy, setMenuBusy] = useState(false);
    const [addOpen, setAddOpen] = useState(false);

    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1400);
    }, []);

    const songs = useMemo(() => {
        return Array.isArray(favoriteSongs) ? favoriteSongs : [];
    }, [favoriteSongs]);

    const queueItems = useMemo(() => {
        return songs
            .map((s) => ({
                type: "song",
                songID: s.songID,
                songName: s.songName,
                creatorName: s.creatorName || "—",
                signedAudio: s.signedAudio || null,
                signedCover: s.signedCover || null,
                album: s.album || null, // jeśli kiedyś backend to dołoży
                duration: s.duration,
                raw: s,
            }))
            .filter((x) => !!x.signedAudio);
    }, [songs]);

    const queueIndexBySongId = useMemo(() => {
        const m = new Map();
        queueItems.forEach((q, i) => m.set(String(q.songID), i));
        return m;
    }, [queueItems]);

    const totalDuration = useMemo(() => {
        return songs.reduce((acc, s) => {
            const d = Number(s?.duration);
            return acc + (Number.isFinite(d) ? d : 0);
        }, 0);
    }, [songs]);

    const playAll = useCallback(() => {
        if (!queueItems.length) return;
        setNewQueue(queueItems, 0);
    }, [queueItems, setNewQueue]);

    const toggleLike = useCallback(
        async (songID) => {
            if (!toggleSongLike) {
                showToast("Brak toggleSongLike w LibraryContext", "error");
                return;
            }

            const liked = likedSongIds?.has(String(songID));
            setLikingId(songID);

            const result = await toggleSongLike(songID, liked);
            if (result?.success) {
                showToast(liked ? "Usunięto z polubionych" : "Dodano do polubionych", "success");
            } else {
                showToast(result?.message || "Błąd polubień", "error");
            }

            setLikingId(null);
        },
        [toggleSongLike, likedSongIds, showToast]
    );

    const handleAddToQueue = useCallback(async () => {
        const songID = activeSong?.songID;
        if (!token || !songID) return;

        setMenuBusy(true);
        try {
            await addSongToQueue(token, songID, "END");
            showToast?.("Dodano do kolejki", "success");
            setMenuOpen(false);
        } catch (e) {
            showToast?.(e?.message || "Błąd dodawania do kolejki", "error");
        } finally {
            setMenuBusy(false);
        }
    }, [token, activeSong?.songID, showToast]);

    const handlePlayNext = useCallback(async () => {
        const songID = activeSong?.songID;
        if (!token || !songID) return;

        setMenuBusy(true);
        try {
            await addSongToQueue(token, songID, "NEXT");
            showToast?.("Ustawiono jako następny", "success");
            setMenuOpen(false);
        } catch (e) {
            showToast?.(e?.message || "Błąd ustawiania następnego", "error");
        } finally {
            setMenuBusy(false);
        }
    }, [token, activeSong?.songID, showToast]);

    if (loading) return <div style={styles.page}>Ładowanie…</div>;
    if (error) return <div style={styles.page}>{error}</div>;

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
                    <div style={styles.likedCover}>
                        <Heart
                            style={{
                                width: 84,
                                height: 84,
                                display: "block",
                                filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.45))",
                            }}
                        />
                    </div>
                </div>

                <div style={{ minWidth: 0 }}>
                    <div style={styles.kicker}>PLAYLISTA</div>
                    <h2 style={styles.h2}>Polubione utwory</h2>

                    <div style={styles.metaLine}>
                        <span style={{ opacity: 0.85 }}>{songs.length} utworów</span>
                        <span style={{ opacity: 0.65 }}> • </span>
                        <span style={{ opacity: 0.85 }}>{formatTotalDuration(totalDuration)}</span>
                    </div>

                    <div style={styles.actions}>
                        <button
                            onClick={playAll}
                            disabled={!queueItems.length}
                            style={{
                                ...styles.primaryBtn,
                                opacity: queueItems.length ? 1 : 0.6,
                                cursor: queueItems.length ? "pointer" : "not-allowed",
                            }}
                            title="Odtwórz"
                        >
                            <Play size={16} style={{ display: "block" }} /> Odtwórz
                        </button>
                    </div>
                </div>
            </div>

            {/* LIST */}
            <div style={styles.list}>
                {songs.length === 0 ? <div style={styles.hint}>Brak polubionych utworów</div> : null}

                {songs.map((s, idx) => {
                    const hidden = !!s?.isHidden || s?.moderationStatus === "HIDDEN";
                    const playable = !!s?.signedAudio && !hidden;

                    const queueIdx = queueIndexBySongId.get(String(s.songID));
                    const canQueue = playable && queueIdx != null;

                    const liked = likedSongIds?.has(String(s.songID));
                    const likeBusy = likingId === s.songID;

                    return (
                        <div
                            key={s.songID || idx}
                            style={{
                                ...styles.row,
                                opacity: playable ? 1 : 0.5,
                                filter: playable ? "none" : "grayscale(0.25)",
                            }}
                            title={!playable ? "Ten utwór jest obecnie niedostępny" : undefined}
                        >
                            <button
                                onClick={() => {
                                    if (!canQueue) return;
                                    setNewQueue(queueItems, queueIdx);
                                }}
                                disabled={!canQueue}
                                style={{
                                    ...styles.rowPlayBtn,
                                    opacity: canQueue ? 1 : 0.45,
                                    cursor: canQueue ? "pointer" : "not-allowed",
                                }}
                                title={canQueue ? "Odtwórz od tego" : "Utwór niedostępny"}
                            >
                                ▶
                            </button>

                            {/* Mini cover */}
                            <div style={styles.miniCoverWrap}>
                                {pickSongCover(s) ? (
                                    <img
                                        src={pickSongCover(s)}
                                        alt=""
                                        style={{
                                            ...styles.miniCoverImg,
                                            opacity: playable ? 1 : 0.7,
                                        }}
                                    />
                                ) : (
                                    <div style={styles.miniCoverPh} />
                                )}
                            </div>

                            <div style={styles.trackNo}>{idx + 1}.</div>

                            <div style={styles.trackMain}>
                                <div style={styles.trackTitle}>
                                    {s.songName || "Utwór"}
                                    {!playable ? (
                                        <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>
                                        (niedostępny)
                                    </span>
                                    ) : null}
                                </div>
                                <div style={styles.trackSub}>{s.creatorName || "—"}</div>
                            </div>

                            <button
                                onClick={() => toggleLike(s.songID)}
                                disabled={likeBusy}
                                title={liked ? "Usuń z polubionych" : "Polub"}
                                style={{
                                    ...styles.likeBtn,
                                    opacity: likeBusy ? 0.6 : 1,
                                    cursor: likeBusy ? "not-allowed" : "pointer",
                                }}
                            >
                                <Heart
                                    size={16}
                                    style={{ display: "block", fill: liked ? "currentColor" : "none" }}
                                />
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    if (!playable) return;
                                    setActiveSong({
                                        type: "song",
                                        songID: s.songID,
                                        title: s.songName || "Utwór",
                                    });
                                    setMenuOpen(true);
                                }}
                                disabled={!playable}
                                style={{
                                    ...styles.moreBtn,
                                    opacity: playable ? 1 : 0.45,
                                    cursor: playable ? "pointer" : "not-allowed",
                                }}
                                title="Więcej"
                            >
                                ⋯
                            </button>

                            <div style={styles.trackTime}>{formatTrackDuration(s.duration)}</div>
                        </div>
                    );
                })}
            </div>

            {/* MODAL: SONG MENU (liked songs) */}
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
                onAddToQueue={handleAddToQueue}
                onPlayNext={handlePlayNext}
            />

            {/* MODAL: ADD TO PLAYLIST */}
            <AddToPlaylistModal
                open={addOpen}
                onClose={() => setAddOpen(false)}
                songID={activeSong?.songID}
                songTitle={activeSong?.title}
                onToast={showToast}
            />
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
        width: 180,
        height: 180,
        borderRadius: 14,
        overflow: "hidden",
        background: "#2a2a2a",
        flex: "0 0 auto",
    },

    likedCover: {
        width: "100%",
        height: "100%",
        borderRadius: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
            "linear-gradient(135deg, rgba(29,185,84,0.95) 0%, rgba(120,70,255,0.95) 55%, rgba(255,80,180,0.95) 100%)",
        boxShadow: "0 20px 50px rgba(0,0,0,0.55)",
        color: "white",
    },

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

    hint: { padding: "8px 2px", opacity: 0.7, fontSize: 13 },

    list: { marginTop: 18 },

    row: {
        display: "grid",
        gridTemplateColumns: "44px 44px 40px 1fr 44px 44px 60px",
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
        justifySelf: "center",
    },
    miniCoverImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
    miniCoverPh: { width: "100%", height: "100%", background: "#2a2a2a" },

    likeBtn: {
        width: 38,
        height: 34,
        borderRadius: 10,
        border: "1px solid #333",
        background: "transparent",
        color: "#1db954",
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
        lineHeight: 0,
        fontWeight: 900,
        fontSize: 18,
    },

    menuBtn: {
        width: 38,
        height: 34,
        borderRadius: 10,
        border: "1px solid #333",
        background: "transparent",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        lineHeight: 0,
        fontWeight: 900,
    },

    trackNo: { opacity: 0.7, textAlign: "right", fontVariantNumeric: "tabular-nums" },

    trackMain: { minWidth: 0, overflow: "hidden" },
    trackTitle: { fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    trackSub: { fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    trackTime: { opacity: 0.75, fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" },
};