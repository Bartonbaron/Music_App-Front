import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Dices } from "lucide-react";
import { usePlayer } from "../../contexts/PlayerContext";
import { mapPodcastToPlayerItem } from "../../utils/playerAdapter";

export default function HomePage() {
    const { token, user } = useAuth();
    const { setNewQueue } = usePlayer();

    const [songs, setSongs] = useState([]);
    const [error, setError] = useState("");
    const [podcasts, setPodcasts] = useState([]);
    const [podcastError, setPodcastError] = useState("");

    // ciekawostki
    const [facts, setFacts] = useState([]);
    const [factsError, setFactsError] = useState("");
    const [factsLoading, setFactsLoading] = useState(false);
    const factsAbortRef = useRef(null);

    const loadFacts = async () => {
        if (!token) return;

        // abort previous "refresh"
        if (factsAbortRef.current) factsAbortRef.current.abort();
        const ac = new AbortController();
        factsAbortRef.current = ac;

        setFactsLoading(true);
        setFactsError("");

        try {
            const res = await fetch("http://localhost:3000/api/home/facts?limit=3", {
                headers: { Authorization: `Bearer ${token}` },
                signal: ac.signal,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "Failed to fetch facts");

            setFacts(Array.isArray(data) ? data : []);
        } catch (e) {
            if (e?.name !== "AbortError") setFactsError(e.message);
        } finally {
            setFactsLoading(false);
        }
    };

    useEffect(() => {
        if (!token) return;
        loadFacts();
        return () => {
            if (factsAbortRef.current) factsAbortRef.current.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // songs
    useEffect(() => {
        if (!token) return;

        let alive = true;

        (async () => {
            try {
                const res = await fetch("http://localhost:3000/api/songs?limit=5", {
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
                const res = await fetch("http://localhost:3000/api/podcasts?limit=5", {
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
    const podcastQueue = useMemo(() => podcasts.filter((p) => !!p.signedAudio), [podcasts]);

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <h2 style={{ margin: 0 }}>Witaj{user ? `, ${user.userName}` : ""}!</h2>
            </header>

            {/* --- NEW: Facts section --- */}
            <div style={styles.factsWrap}>
                <div style={styles.factsHead}>
                    <h3 style={{ margin: 0 }}>Ciekawostki</h3>

                    <button
                        style={{
                            ...styles.randomBtn,
                            opacity: factsLoading ? 0.6 : 1,
                            cursor: factsLoading ? "not-allowed" : "pointer",
                        }}
                        onClick={loadFacts}
                        disabled={factsLoading}
                        title="Wylosuj nowe"
                    >
                        <Dices size={16} />
                    </button>
                </div>

                {factsError && <div style={styles.error}>{factsError}</div>}

                {factsLoading && facts.length === 0 ? (
                    <div style={{ opacity: 0.75 }}>Ładowanie...</div>
                ) : facts.length === 0 ? (
                    <div style={{ opacity: 0.75 }}>Brak ciekawostek do pokazania.</div>
                ) : (
                    <div style={styles.factsGrid}>
                        {facts.map((f) => (
                            <div key={`${f.type}-${f.id}`} style={styles.factCard}>
                                <div style={styles.factTop}>
                                    {f.type === "album" ? (
                                        f.signedCover ? (
                                            <img src={f.signedCover} alt="" style={styles.factImg} />
                                        ) : (
                                            <div style={styles.factImgPlaceholder} />
                                        )
                                    ) : f.signedProfilePicURL ? (
                                        <img src={f.signedProfilePicURL} alt="" style={styles.factImg} />
                                    ) : (
                                        <div style={styles.factImgPlaceholder} />
                                    )}
                                </div>

                                <div style={styles.factBody}>
                                    <div style={styles.factTag}>{f.type === "album" ? "ALBUM" : "TWÓRCA"}</div>

                                    <div style={styles.factTitle} title={f.title}>
                                        {f.title}
                                    </div>

                                    {f.type === "album" ? (
                                        <div style={{ fontSize: 12, opacity: 0.75 }}>{f.creatorName || "—"}</div>
                                    ) : (
                                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                                            Obserwujący: {typeof f.followers === "number" ? f.followers : "—"}
                                        </div>
                                    )}

                                    <div style={styles.factText}>
                                        {String(f.text || "").slice(0, 220)}
                                        {String(f.text || "").length > 220 ? "…" : ""}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Songs */}
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

                                <div style={{ fontSize: 12, opacity: 0.75 }}>{s.creatorName || "—"}</div>

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
                                    ▶ Odtwórz
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

                                    <div style={{ fontSize: 12, opacity: 0.75 }}>{p.creatorName || "—"}</div>

                                    <button
                                        style={{
                                            ...styles.playBtn,
                                            opacity: p.signedAudio ? 1 : 0.5,
                                            cursor: p.signedAudio ? "pointer" : "not-allowed",
                                        }}
                                        disabled={!p.signedAudio}
                                        onClick={() => {
                                            const startIdx = podcastQueue.findIndex((x) => x.podcastID === p.podcastID);
                                            if (startIdx >= 0) setNewQueue(podcastQueue, startIdx);
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
        marginBottom: "18px",
    },

    factsWrap: { marginBottom: "30px" },

    factsHead: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },

    randomBtn: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "#1e1e1e",
        color: "white",
        fontWeight: 800,
    },

    factsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 12,
    },

    factCard: {
        backgroundColor: "#1e1e1e",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #2a2a2a",
        display: "flex",
        minHeight: 150,
    },

    factTop: { width: 120, background: "#2a2a2a" },
    factImg: { width: "100%", height: "100%", objectFit: "cover" },
    factImgPlaceholder: { width: "100%", height: "100%", background: "#2a2a2a" },
    factBody: { padding: 12, display: "flex", flexDirection: "column", gap: 6, flex: 1 },
    factTag: { fontSize: 11, opacity: 0.7, letterSpacing: 1, fontWeight: 900 },
    factTitle: {
        fontWeight: 900,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    factText: { fontSize: 13, opacity: 0.9, lineHeight: 1.35 },

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