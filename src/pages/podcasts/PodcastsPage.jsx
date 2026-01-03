import { useEffect, useState } from "react";
import { Mic2 } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";

import { fetchPodcasts } from "../../api/podcasts.api";
import { mapPodcastToPlayerItem } from "../../utils/playerAdapter";

import FavoritePodcastButton from "../../components/common/FavoritePodcastButton";

export default function PodcastsPage() {
    const { token } = useAuth();
    const { setNewQueue } = usePlayer();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!token) return;

        let alive = true;
        setLoading(true);
        setError("");

        (async () => {
            try {
                const data = await fetchPodcasts(token);

                const mapped = (Array.isArray(data) ? data : [])
                    .map(mapPodcastToPlayerItem)
                    .filter((p) => !!p?.signedAudio);

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
                    >
                        ▶ Odtwórz wszystko
                    </button>
                </div>
            </div>

            {error && <div style={styles.error}>{error}</div>}
            {loading && <div style={{ opacity: 0.7 }}>Ładowanie…</div>}

            {/* GRID */}
            <div style={styles.grid}>
                {items.map((p, idx) => (
                    <div
                        key={p.podcastID}
                        style={styles.card}
                        role="button"
                        tabIndex={0}
                        onClick={() => setNewQueue(items, idx)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") setNewQueue(items, idx);
                        }}
                        title="Kliknij, aby odtworzyć od tego"
                    >
                        <div style={styles.cardTop}>
                            {p.signedCover ? (
                                <img src={p.signedCover} alt="" style={styles.cover} />
                            ) : (
                                <div style={styles.coverPh} />
                            )}
                        </div>

                        <div style={styles.cardBody}>
                            <div style={styles.name} title={p.title}>
                                {p.title || `Podcast ${p.podcastID}`}
                            </div>

                            <div style={styles.sub}>{p.creatorName || "—"}</div>

                            <div style={styles.actions}>
                                <FavoritePodcastButton
                                    podcastID={p.podcastID}
                                    size={16}
                                    style={styles.iconBtn}
                                />

                                <button
                                    style={styles.playBtn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setNewQueue(items, idx);
                                    }}
                                    type="button"
                                >
                                    ▶ Odtwórz
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
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
    },

    header: {
        display: "flex",
        gap: 20,
        alignItems: "center",
        marginBottom: 24,
    },

    hero: {
        width: 140,
        height: 140,
        borderRadius: 16,
        background: "#1e1e1e",
        border: "1px solid #2a2a2a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
    },

    kicker: { fontSize: 12, opacity: 0.7, fontWeight: 800 },
    title: { fontSize: 34, margin: "6px 0" },
    meta: { fontSize: 13, opacity: 0.75 },

    playAll: {
        marginTop: 10,
        padding: "10px 14px",
        borderRadius: 12,
        border: "none",
        background: "#1db954",
        color: "#000",
        fontWeight: 900,
    },

    error: {
        background: "#2a1a1a",
        border: "1px solid #5a2a2a",
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
    },

    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
        gap: 15,
    },

    card: {
        background: "#1e1e1e",
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        overflow: "hidden",
        cursor: "pointer",
    },

    cardTop: { height: 160, background: "#2a2a2a" },
    cover: { width: "100%", height: "100%", objectFit: "cover" },
    coverPh: { width: "100%", height: "100%", background: "#2a2a2a" },

    cardBody: {
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
    },

    name: {
        fontWeight: 800,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },

    sub: { fontSize: 12, opacity: 0.75 },

    actions: {
        display: "flex",
        gap: 10,
        alignItems: "center",
    },

    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        border: "1px solid #333",
        background: "transparent",
        color: "#1db954",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        lineHeight: 0,
    },

    playBtn: {
        flex: 1,
        padding: "10px 12px",
        borderRadius: 10,
        border: "none",
        background: "#1db954",
        color: "#000",
        fontWeight: 900,
        cursor: "pointer",
    },
};