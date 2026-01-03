import { useCallback, useMemo, useState } from "react";
import { Mic2, Play } from "lucide-react";

import { usePlayer } from "../../contexts/PlayerContext";
import { useLibrary } from "../../contexts/LibraryContext";

import FavoritePodcastButton from "../../components/common/FavoritePodcastButton";

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
    const r = total % 60;

    if (h > 0) {
        return `${h} godz ${m} min`;
    }

    return `${m} min ${r} s`;
}

export default function MyEpisodesPage() {
    const { setNewQueue } = usePlayer();
    const { favoritePodcasts, loading, error } = useLibrary();

    const [toast, setToast] = useState(null);

    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1400);
    }, []);

    const podcasts = useMemo(() => {
        return Array.isArray(favoritePodcasts) ? favoritePodcasts : [];
    }, [favoritePodcasts]);

    const queueItems = useMemo(() => {
        return podcasts
            .map((p) => ({
                type: "podcast",
                podcastID: p.podcastID,
                podcastName: p.podcastName,
                title: p.podcastName ?? p.title ?? `Podcast ${p.podcastID}`,
                creatorName: p.creatorName || "—",
                signedAudio: p.signedAudio || null,
                signedCover: p.signedCover || null,
                duration: p.duration,
                raw: p,
            }))
            .filter((x) => !!x.signedAudio);
    }, [podcasts]);

    const queueIndexByPodcastId = useMemo(() => {
        const m = new Map();
        queueItems.forEach((q, i) => m.set(String(q.podcastID), i));
        return m;
    }, [queueItems]);

    const totalDuration = useMemo(() => {
        return podcasts.reduce((acc, p) => {
            const d = Number(p?.duration);
            return acc + (Number.isFinite(d) ? d : 0);
        }, 0);
    }, [podcasts]);

    const playAll = useCallback(() => {
        if (!queueItems.length) return;
        setNewQueue(queueItems, 0);
    }, [queueItems, setNewQueue]);

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
                        <Mic2
                            style={{
                                width: 84,
                                height: 84,
                                display: "block",
                                filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.45))",
                            }}
                            strokeWidth={2.2}
                        />
                    </div>
                </div>

                <div style={{ minWidth: 0 }}>
                    <div style={styles.kicker}>PLAYLISTA</div>
                    <h2 style={styles.h2}>Moje odcinki</h2>

                    <div style={styles.metaLine}>
                        <span style={{ opacity: 0.85 }}>{podcasts.length} odcinków</span>
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
                            type="button"
                        >
                            <Play size={16} style={{ display: "block" }} /> Odtwórz
                        </button>
                    </div>
                </div>
            </div>

            {/* LIST */}
            <div style={styles.list}>
                {podcasts.length === 0 ? <div style={styles.hint}>Brak zapisanych odcinków</div> : null}

                {podcasts.map((p, idx) => {
                    const queueIdx = queueIndexByPodcastId.get(String(p.podcastID));
                    const playable = queueIdx != null;

                    return (
                        <div key={p.podcastID || idx} style={styles.row}>
                            <button
                                onClick={() => setNewQueue(queueItems, queueIdx ?? 0)}
                                disabled={!playable}
                                style={{
                                    ...styles.rowPlayBtn,
                                    opacity: playable ? 1 : 0.45,
                                    cursor: playable ? "pointer" : "not-allowed",
                                }}
                                title="Odtwórz od tego"
                                type="button"
                            >
                                ▶
                            </button>

                            <div style={styles.trackNo}>{idx + 1}.</div>

                            <div style={styles.trackMain}>
                                <div style={styles.trackTitle}>{p.podcastName || p.title || "Podcast"}</div>
                                <div style={styles.trackSub}>{p.creatorName || "—"}</div>
                            </div>

                            <FavoritePodcastButton
                                podcastID={p.podcastID}
                                size={16}
                                onToast={showToast}
                                style={styles.favBtn}
                            />

                            <div style={styles.trackTime}>{formatTrackDuration(p.duration)}</div>
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
        background:
            "linear-gradient(135deg, rgba(255,200,0,0.95) 0%, rgba(255,80,180,0.95) 55%, rgba(120,70,255,0.95) 100%)",
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
        gridTemplateColumns: "44px 40px 1fr 44px 60px",
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

    favBtn: {
        width: 38,
        height: 34,
        borderRadius: 10,
        border: "1px solid #333",
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        lineHeight: 0,
    },

    trackNo: { opacity: 0.7, textAlign: "right" },

    trackMain: { minWidth: 0 },
    trackTitle: { fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    trackSub: { fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    trackTime: { opacity: 0.75, fontSize: 12, textAlign: "right" },
};