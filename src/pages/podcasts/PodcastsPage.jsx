import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Mic2 } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";

import { fetchPodcasts } from "../../api/content/podcasts.api.js";
import { mapPodcastToPlayerItem } from "../../utils/playerAdapter";
import { formatTrackDuration } from "../../utils/time.js";

export default function PodcastsPage() {
    const { token } = useAuth();
    const { setNewQueue } = usePlayer();
    const navigate = useNavigate();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!token) {
            setItems([]);
            setLoading(false);
            setError("Zaloguj się, aby zobaczyć podcasty.");
            return;
        }

        let alive = true;
        setLoading(true);
        setError("");

        (async () => {
            try {
                const data = await fetchPodcasts(token);

                const mapped = (Array.isArray(data) ? data : [])
                    .map((raw) => {
                        const item = mapPodcastToPlayerItem(raw);

                        const duration =
                            raw?.duration ??
                            item?.duration ??
                            item?.raw?.duration ??
                            null;

                        return {
                            ...item,
                            duration,
                            playable: !!item?.signedAudio,
                        };
                    })
                    .filter((p) => p.playable);

                if (alive) setItems(mapped);
            } catch (e) {
                if (alive) setError(e?.message || "Failed to load podcasts");
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [token]);

    const canPlayAll = items.length > 0;

    const indexById = useMemo(() => {
        const m = new Map();
        items.forEach((p, i) => m.set(String(p.podcastID), i));
        return m;
    }, [items]);

    return (
        <div style={styles.page}>
            {/* HEADER */}
            <div style={styles.header}>
                <div style={styles.hero}>
                    <Mic2 style={{ width: 64, height: 64 }} strokeWidth={2.2} />
                </div>

                <div>
                    <div style={styles.kicker}>PODCASTY</div>
                    <h1 style={styles.title}>Podcasty</h1>
                    <div style={styles.meta}>{items.length} odc.</div>

                    <button
                        style={{
                            ...styles.playAll,
                            opacity: canPlayAll ? 1 : 0.5,
                            cursor: canPlayAll ? "pointer" : "not-allowed",
                        }}
                        disabled={!canPlayAll}
                        onClick={() => setNewQueue(items, 0)}
                        type="button"
                        title={canPlayAll ? "Odtwórz wszystko" : "Brak dostępnych podcastów"}
                    >
                        <Play size={16} style={{ display: "block" }} /> Odtwórz wszystko
                    </button>
                </div>
            </div>

            {error ? <div style={styles.error}>{error}</div> : null}
            {loading ? <div style={{ opacity: 0.7 }}>Ładowanie…</div> : null}

            {/* GRID */}
            <div style={styles.grid}>
                {items.map((p, idx) => {
                    const playable = !!p.playable; // zawsze true po filtrze, ale zostawiamy dla spójności

                    return (
                        <div
                            key={p.podcastID ?? idx}
                            style={styles.card}
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate(`/podcasts/${p.podcastID}`)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") navigate(`/podcasts/${p.podcastID}`);
                            }}
                            title="Otwórz szczegóły"
                        >
                            <div style={styles.cardTop}>
                                {p.signedCover ? (
                                    <img
                                        src={p.signedCover}
                                        alt=""
                                        style={styles.cover}
                                        onClick={() => navigate(`/podcasts/${p.podcastID}`)}
                                    />
                                ) : (
                                    <div style={styles.coverPh} />
                                )}
                            </div>

                            <div style={styles.cardBody}>
                                <div
                                    style={styles.name}
                                    title={p.title}
                                    onClick={() => navigate(`/podcasts/${p.podcastID}`)}
                                >
                                    {p.title || `Podcast ${p.podcastID}`}
                                </div>

                                <div style={styles.sub} title={p.creatorName || "—"}>
                                    {p.creatorName || "—"}
                                </div>

                                <div style={styles.subSmall} title={p.duration ? formatTrackDuration(p.duration) : "—"}>
                                    {p.duration ? formatTrackDuration(p.duration) : "—"}
                                </div>

                                <div style={styles.actions}>
                                    <button
                                        style={{
                                            ...styles.playBtn,
                                            opacity: playable ? 1 : 0.55,
                                            cursor: playable ? "pointer" : "not-allowed",
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const startIdx = indexById.get(String(p.podcastID));
                                            if (startIdx == null) return;
                                            setNewQueue(items, startIdx);
                                        }}
                                        type="button"
                                        disabled={!playable}
                                        title={playable ? "Odtwórz" : "Podcast niedostępny"}
                                    >
                                        ▶ Odtwórz
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
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

    header: {
        display: "flex",
        alignItems: "center",
        gap: 18,
        marginBottom: 18,
        flexWrap: "wrap",
    },

    hero: {
        width: 92,
        height: 92,
        borderRadius: 18,
        background:
            "linear-gradient(135deg, rgba(255,200,0,0.95) 0%, rgba(255,80,180,0.95) 55%, rgba(120,70,255,0.95) 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
    },

    kicker: { fontSize: 12, opacity: 0.7, letterSpacing: 1.2, fontWeight: 900 },

    title: {
        margin: "6px 0 6px",
        fontSize: 34,
        lineHeight: 1.08,
    },

    meta: { opacity: 0.8, fontSize: 13, marginBottom: 10 },

    playAll: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 12,
        border: "none",
        background: "#1db954",
        color: "#000",
        fontWeight: 900,
    },

    error: {
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #7a2a2a",
        background: "#2a1515",
        color: "white",
        marginBottom: 12,
        maxWidth: 820,
    },

    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 14,
        marginTop: 14,
    },

    card: {
        borderRadius: 16,
        border: "1px solid #2a2a2a",
        background: "#151515",
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        minHeight: 280,
    },

    cardTop: {
        height: 160,
        background: "#2a2a2a"
    },

    cover: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
    },

    coverPh: {
        width: "100%",
        height: "100%",
        background: "#242424",
    },

    cardBody: {
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8 
    },

    name: {
        fontWeight: 900,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },

    sub: {
        fontSize: 13,
        opacity: 0.8,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },

    actions: {
        marginTop: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },

    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
    },

    playBtn: {
        marginTop: 6,
        padding: "10px 12px",
        borderRadius: 10,
        border: "none",
        background: "#1db954",
        color: "#000",
        fontWeight: 900,
    },

    subSmall: {
        fontSize: 12,
        opacity: 0.65,
        fontVariantNumeric: "tabular-nums",
    },
};