import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { mapPodcastToPlayerItem } from "../../utils/playerAdapter";

export default function HomePage() {
    const { token, user, logout } = useAuth();
    const { setNewQueue } = usePlayer();

    const [songs, setSongs] = useState([]);
    const [error, setError] = useState("");
    const [podcasts, setPodcasts] = useState([]);
    const [podcastError, setPodcastError] = useState("");

    useEffect(() => {
        if (!token) return;

        let alive = true;

        (async () => {
            try {
                const res = await fetch("http://localhost:3000/api/songs", {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || "Failed to fetch songs");

                const normalized = (Array.isArray(data) ? data : []).map((s) => ({
                    type: "song",
                    songID: s.songID,
                    songName: s.songName,
                    title: s.songName,
                    creatorName: s.creatorName || null,
                    signedAudio: s.signedAudio,
                    signedCover: s.signedCover,
                    raw: s,
                }));

                if (alive) setSongs(normalized);
            } catch (e) {
                if (alive) setError(e.message);
            }
        })();

        return () => {
            alive = false;
        };
    }, [token]);

    useEffect(() => {
        if (!token) return;

        let alive = true;

        (async () => {
            try {
                const res = await fetch("http://localhost:3000/api/podcasts", {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || "Failed to fetch podcasts");

                const normalized = (Array.isArray(data) ? data : [])
                    .map(mapPodcastToPlayerItem)
                    .filter((p) => !!p.signedAudio);

                if (alive) setPodcasts(normalized);
            } catch (e) {
                if (alive) setPodcastError(e.message);
            }
        })();

        return () => {
            alive = false;
        };
    }, [token]);

    const queueItems = useMemo(() => songs.filter((x) => !!x.signedAudio), [songs]);
    const podcastQueue = useMemo(
        () => podcasts.filter((p) => !!p.signedAudio),
        [podcasts]
    );

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <h2>Witaj{user ? `, ${user.userName}` : ""}!</h2>

            </header>

            <div style={styles.section}>
                <h3 style={styles.title}>Utwory</h3>

                {error && <div style={styles.error}>{error}</div>}

                <div style={styles.grid}>
                    {songs.map((s) => (
                        <div key={s.songID} style={styles.card}>
                            <div style={styles.cardTop}>
                                {s.signedCover ? (
                                    <img src={s.signedCover} alt="" style={styles.cover} />
                                ) : (
                                    <div style={styles.coverPlaceholder} />
                                )}
                            </div>

                            <div style={styles.cardBody}>
                                <div style={styles.name}>{s.songName || `Utwór ${s.songID}`}</div>

                                <div style={{ fontSize: 12, opacity: 0.75 }}>
                                    {s.creatorName || "—"}
                                </div>

                                <button
                                    style={{
                                        ...styles.playBtn,
                                        opacity: s.signedAudio ? 1 : 0.5,
                                        cursor: s.signedAudio ? "pointer" : "not-allowed",
                                    }}
                                    disabled={!s.signedAudio}
                                    onClick={() => {
                                        const startIdx = queueItems.findIndex((q) => q.songID === s.songID);
                                        if (startIdx >= 0) setNewQueue(queueItems, startIdx);
                                    }}
                                >
                                    ▶ Odtwórz od tego
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {/* Podcasty */}
            <div style={styles.section}>
                <h3 style={styles.title}>Podcasty</h3>

                {podcastError && <div style={styles.error}>{podcastError}</div>}

                {podcasts.length === 0 ? (
                    <div style={{ opacity: 0.75 }}>Brak dostępnych podcastów.</div>
                ) : (
                    <div style={styles.grid}>
                        {podcasts.map((p) => (
                            <div key={p.podcastID} style={styles.card}>
                                <div style={styles.cardTop}>
                                    {p.signedCover ? (
                                        <img src={p.signedCover} alt="" style={styles.cover} />
                                    ) : (
                                        <div style={styles.coverPlaceholder} />
                                    )}
                                </div>

                                <div style={styles.cardBody}>
                                    <div style={styles.name} title={p.title}>
                                        {p.title}
                                    </div>

                                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                                        {p.creatorName || "—"}
                                    </div>

                                    <button
                                        style={{
                                            ...styles.playBtn,
                                            opacity: p.signedAudio ? 1 : 0.5,
                                            cursor: p.signedAudio ? "pointer" : "not-allowed",
                                        }}
                                        disabled={!p.signedAudio}
                                        onClick={() => {
                                            const startIdx = podcastQueue.findIndex(
                                                (x) => x.podcastID === p.podcastID
                                            );
                                            if (startIdx >= 0) {
                                                setNewQueue(podcastQueue, startIdx);
                                            }
                                        }}
                                    >
                                        ▶ Odtwórz
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        backgroundColor: "#121212",
        color: "white",
        padding: "20px 40px",
    },
    header: {
        display: "flex",
        justifyContent: "flex-start",
        gap: "30px",
        alignItems: "center",
        marginBottom: "35px",
    },

    section: { marginBottom: "40px" },
    title: { marginBottom: "15px" },

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
        gap: "15px",
    },
    card: {
        backgroundColor: "#1e1e1e",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid #2a2a2a",
    },
    cardTop: { height: 160, background: "#2a2a2a" },
    cover: { width: "100%", height: "100%", objectFit: "cover" },
    coverPlaceholder: { width: "100%", height: "100%", background: "#2a2a2a" },
    cardBody: { padding: 12, display: "flex", flexDirection: "column", gap: 10 },
    name: { fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    playBtn: {
        padding: "10px 12px",
        borderRadius: "10px",
        border: "none",
        background: "#1db954",
        color: "#000",
        fontWeight: 800,
    },
};