import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Mic2, Play, ArrowLeft } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";

import { fetchPodcast } from "../../api/podcasts.api";
import { mapPodcastToPlayerItem } from "../../utils/playerAdapter";
import FavoritePodcastButton from "../../components/common/FavoritePodcastButton";
import {formatTrackDuration} from "../../utils/time.js";

export default function PodcastPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const { token } = useAuth();
    const { setNewQueue, currentItem, isPlaying } = usePlayer();

    const [podcast, setPodcast] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [toast, setToast] = useState(null);
    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1400);
    }, []);

    useEffect(() => {
        if (!token || !id) return;

        let alive = true;
        setLoading(true);
        setError("");

        (async () => {
            try {
                const data = await fetchPodcast(token, id);
                const item = mapPodcastToPlayerItem(data);

                // Ujednolicenie duration (bez raw)
                const duration = data?.duration ?? item?.raw?.duration ?? null;

                if (alive) {
                    setPodcast({
                        ...item,
                        duration,
                    });
                }
            } catch (e) {
                if (alive) setError(e?.message || "Nie udało się pobrać podcastu");
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [token, id]);

    const playable = !!podcast?.signedAudio;

    const isNowPlaying = useMemo(() => {
        if (!currentItem || !podcast) return false;
        return (
            currentItem.type === "podcast" &&
            String(currentItem.podcastID) === String(podcast.podcastID)
        );
    }, [currentItem, podcast]);

    const nowPlayingLabel = useMemo(() => {
        if (!isNowPlaying) return "Podcast";
        return isPlaying ? "Teraz odtwarzane" : "Wstrzymane";
    }, [isNowPlaying, isPlaying]);

    const onPlay = useCallback(() => {
        if (!podcast?.signedAudio) return;
        setNewQueue([podcast], 0);
    }, [podcast, setNewQueue]);

    if (!token) {
        return (
            <div style={styles.page}>
                <div style={{ opacity: 0.75 }}>Zaloguj się, aby zobaczyć podcast.</div>
            </div>
        );
    }

    if (loading) return <div style={styles.page}>Ładowanie…</div>;
    if (error) return <div style={styles.page}>{error}</div>;
    if (!podcast) return <div style={styles.page}>Nie znaleziono podcastu.</div>;

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

            {/* TOP BAR */}
            <div style={styles.topBar}>
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    style={styles.backBtn}
                    title="Wstecz"
                >
                    <ArrowLeft size={18} style={{ display: "block" }} />
                </button>

                <div style={{ opacity: 0.75, fontSize: 13 }}>{nowPlayingLabel}</div>
            </div>

            {/* HEADER */}
            <div style={styles.header}>
                <div style={styles.coverWrap}>
                    {podcast.signedCover ? (
                        <img src={podcast.signedCover} alt="" style={styles.coverImg} />
                    ) : (
                        <div style={styles.coverFallback}>
                            <Mic2 size={58} style={{ display: "block", opacity: 0.9 }} />
                        </div>
                    )}
                </div>

                <div style={{ minWidth: 0 }}>
                    <div style={styles.kicker}>ODCINEK</div>
                    <h1 style={styles.h1} title={podcast.title}>
                        {podcast.title || "Podcast"}
                    </h1>

                    <div style={styles.metaLine}>
                        <span style={{ opacity: 0.9 }}>{podcast.creatorName || "—"}</span>
                        <span style={{ opacity: 0.65 }}> • </span>
                        <span style={{ opacity: 0.85 }}>{formatTrackDuration(podcast.duration)}</span>
                    </div>

                    <div style={styles.actions}>
                        <button
                            type="button"
                            onClick={onPlay}
                            disabled={!playable}
                            style={{
                                ...styles.primaryBtn,
                                opacity: playable ? 1 : 0.6,
                                cursor: playable ? "pointer" : "not-allowed",
                            }}
                            title={playable ? "Odtwórz" : "Brak pliku audio"}
                        >
                            <Play size={16} style={{ display: "block" }} />
                            {isNowPlaying ? (isPlaying ? "Odtwarzasz" : "Wznów") : "Odtwórz"}
                        </button>

                        <FavoritePodcastButton
                            podcastID={podcast.podcastID}
                            size={16}
                            onToast={showToast}
                            title="Moje odcinki"
                            style={styles.favBtn}
                        />
                    </div>

                    {podcast.raw?.description ? (
                        <div style={styles.desc}>{podcast.raw.description}</div>
                    ) : (
                        <div style={{ ...styles.desc, opacity: 0.65 }}>Brak opisu.</div>
                    )}
                </div>
            </div>

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

    header: { display: "flex", gap: 18, alignItems: "flex-start" },

    coverWrap: {
        width: 200,
        height: 200,
        borderRadius: 14,
        overflow: "hidden",
        background: "#2a2a2a",
        border: "1px solid #2a2a2a",
        flex: "0 0 auto",
    },

    coverImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },

    coverFallback: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
            "linear-gradient(135deg, rgba(255,200,0,0.95) 0%, rgba(255,80,180,0.95) 55%, rgba(120,70,255,0.95) 100%)",
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

    metaLine: { opacity: 0.9, fontSize: 13 },

    actions: { marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

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

    favBtn: {
        width: 44,
        height: 40,
        borderRadius: 12,
        border: "1px solid #333",
        background: "transparent",
        // kolor spójny z "Moje odcinki" (zielone zostawiamy dla like'ów utworów)
        color: "#ffc800",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        lineHeight: 0,
    },

    desc: {
        marginTop: 14,
        maxWidth: 780,
        lineHeight: 1.55,
        opacity: 0.9,
        whiteSpace: "pre-wrap",
    },
};