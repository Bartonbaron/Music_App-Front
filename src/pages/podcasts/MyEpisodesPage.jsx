import { useCallback, useMemo, useState } from "react";
import { Mic2, Heart, Play } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useLibrary } from "../../contexts/LibraryContext";
import { formatTrackDuration, formatTotalDuration } from "../../utils/time.js";
import { addPodcastToQueue } from "../../api/playback/queue.api.js";
import PodcastActionsModal from "../../components/actions/PodcastActionsModal.jsx";

function pickPodcastCover(p) {
    return p?.signedCover || null;
}

export default function MyEpisodesPage() {
    const { setNewQueue } = usePlayer();
    const { token } = useAuth();
    const { favoritePodcasts, favoritePodcastIds, loading, error, togglePodcastFavorite } = useLibrary();

    const [toast, setToast] = useState(null);
    const [busyId, setBusyId] = useState(null);

    const [menuOpen, setMenuOpen] = useState(false);
    const [activePodcast, setActivePodcast] = useState(null);
    const [menuBusy, setMenuBusy] = useState(false);

    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1400);
    }, []);

    const episodes = useMemo(() => (Array.isArray(favoritePodcasts) ? favoritePodcasts : []), [favoritePodcasts]);

    const queueItems = useMemo(() => {
        return episodes
            .map((p) => ({
                type: "podcast",
                podcastID: p.podcastID,
                title: p.title || `Podcast ${p.podcastID}`,
                creatorName: p.creatorName || "—",
                signedAudio: p.signedAudio || null,
                signedCover: p.signedCover || null,
                duration: p.duration,
                raw: p,
            }))
            .filter((x) => !!x.signedAudio);
    }, [episodes]);

    const queueIndexById = useMemo(() => {
        const m = new Map();
        queueItems.forEach((q, i) => m.set(String(q.podcastID), i));
        return m;
    }, [queueItems]);

    const totalDuration = useMemo(() => {
        return episodes.reduce((acc, p) => {
            const d = Number(p?.duration);
            return acc + (Number.isFinite(d) ? d : 0);
        }, 0);
    }, [episodes]);

    const playAll = useCallback(() => {
        if (!queueItems.length) return;
        setNewQueue(queueItems, 0);
    }, [queueItems, setNewQueue]);

    const removeFromMyEpisodes = useCallback(
        async (podcastID) => {
            if (!token) {
                showToast("Zaloguj się, aby usuwać odcinki z biblioteki", "error");
                return;
            }
            if (!podcastID) return;

            if (!togglePodcastFavorite) {
                showToast("Brak togglePodcastFavorite w LibraryContext", "error");
                return;
            }

            setBusyId(podcastID);
            try {
                // isFavorite = true -> unfavorite
                const result = await togglePodcastFavorite(podcastID, true);
                if (!result?.success) throw new Error(result?.message || "Błąd usuwania");

                showToast("Usunięto z Moich odcinków", "success");
            } catch (e) {
                showToast(e?.message || "Błąd usuwania", "error");
            } finally {
                setBusyId(null);
            }
        },
        [token, togglePodcastFavorite, showToast]
    );

    const handleAddToQueue = useCallback(async () => {
        const podcastID = activePodcast?.podcastID;
        if (!token || !podcastID) return;

        setMenuBusy(true);
        try {
            await addPodcastToQueue(token, podcastID, "END");
            showToast?.("Dodano do kolejki", "success");
            setMenuOpen(false);
        } catch (e) {
            showToast?.(e?.message || "Błąd dodawania do kolejki", "error");
        } finally {
            setMenuBusy(false);
        }
    }, [token, activePodcast?.podcastID, showToast]);

    const handlePlayNext = useCallback(async () => {
        const podcastID = activePodcast?.podcastID;
        if (!token || !podcastID) return;

        setMenuBusy(true);
        try {
            await addPodcastToQueue(token, podcastID, "NEXT");
            showToast?.("Ustawiono jako następny", "success");
            setMenuOpen(false);
        } catch (e) {
            showToast?.(e?.message || "Błąd ustawiania następnego", "error");
        } finally {
            setMenuBusy(false);
        }
    }, [token, activePodcast?.podcastID, showToast]);

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
                    <div style={styles.episodesCover}>
                        <Mic2 strokeWidth={2.2} style={{ width: 84, height: 84, display: "block", opacity: 0.9 }} />
                    </div>
                </div>

                <div style={{ minWidth: 0 }}>
                    <div style={styles.kicker}>PLAYLISTA</div>
                    <h2 style={styles.h2}>Moje odcinki</h2>

                    <div style={styles.metaLine}>
                        <span style={{ opacity: 0.85 }}>{episodes.length} pozycji</span>
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
                {episodes.length === 0 ? <div style={styles.hint}>Brak zapisanych odcinków</div> : null}

                {episodes.map((p, idx) => {
                    const hidden = !!p?.isHidden || p?.moderationStatus === "HIDDEN";
                    const playable = !!p?.signedAudio && !hidden;

                    const queueIdx = queueIndexById.get(String(p.podcastID));
                    const canQueue = playable && queueIdx != null;

                    const title = p.title || p.podcastName || `Podcast ${p.podcastID}`;
                    const creatorName = p.creatorName || "—";

                    const isFav = favoritePodcastIds?.has(String(p.podcastID));
                    const isBusy = busyId === p.podcastID;

                    return (
                        <div
                            key={p.podcastID || idx}
                            style={{
                                ...styles.row,
                                opacity: playable ? 1 : 0.5,
                                filter: playable ? "none" : "grayscale(0.25)",
                            }}
                            title={!playable ? "Ten podcast jest obecnie niedostępny" : undefined}
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
                                title={canQueue ? "Odtwórz od tego" : "Podcast niedostępny"}
                            >
                                ▶
                            </button>

                            {/* Mini cover */}
                            <div style={styles.miniCoverWrap}>
                                {pickPodcastCover(p) ? (
                                    <img
                                        src={pickPodcastCover(p)}
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
                                <div style={styles.trackTitle} title={title}>
                                    {title}
                                    {!playable ? (
                                        <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>
                                (niedostępny)
                            </span>
                                    ) : null}
                                </div>
                                <div style={styles.trackSub} title={creatorName}>
                                    {creatorName}
                                </div>
                            </div>

                            <button
                                onClick={() => removeFromMyEpisodes(p.podcastID)}
                                disabled={!isFav || isBusy}
                                title="Usuń z Moich odcinków"
                                style={{
                                    ...styles.likeBtn,
                                    opacity: !isFav || isBusy ? 0.5 : 1,
                                    cursor: !isFav || isBusy ? "not-allowed" : "pointer",
                                }}
                                type="button"
                            >
                                <Heart size={16} style={{ display: "block" }} fill="currentColor" />
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    if (!playable) return;
                                    setActivePodcast({
                                        type: "podcast",
                                        podcastID: p.podcastID,
                                        title,
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

                            <div style={styles.trackTime}>{formatTrackDuration(p.duration)}</div>
                        </div>
                    );
                })}
            </div>
            <PodcastActionsModal
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                podcastTitle={activePodcast?.title}
                busy={menuBusy}
                onAddToQueue={handleAddToQueue}
                onPlayNext={handlePlayNext}
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

    episodesCover: {
        width: "100%",
        height: "100%",
        borderRadius: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, rgba(255,200,0,0.95) 0%, rgba(255,80,180,0.95) 55%, rgba(120,70,255,0.95) 100%)",
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

    trackNo: { opacity: 0.7, textAlign: "right", fontVariantNumeric: "tabular-nums" },

    trackMain: { minWidth: 0, overflow: "hidden" },
    trackTitle: { fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    trackSub: { fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    trackTime: { opacity: 0.75, fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" },
};