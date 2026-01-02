import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { fetchPlayHistory, clearPlayHistory } from "../../api/playHistory";
import { mapSongToPlayerItem, mapPodcastToPlayerItem } from "../../utils/playerAdapter";

export default function HomePage() {
    const { token, user, logout } = useAuth();
    const { setNewQueue } = usePlayer();

    const [songs, setSongs] = useState([]);
    const [error, setError] = useState("");

    const [history, setHistory] = useState([]);
    const [historyError, setHistoryError] = useState("");
    const [historyLoading, setHistoryLoading] = useState(false);

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

    // Pobranie historii odtwarzania
    const refetchHistory = async () => {
        if (!token) return;
        setHistoryLoading(true);
        setHistoryError("");
        try {
            const data = await fetchPlayHistory(token);
            const items = (data?.items || [])
                .map(mapHistoryToCard)
                .filter(Boolean)
                .filter((x) => !!x.signedAudio);
            setHistory(items);
        } catch (e) {
            setHistoryError(e.message);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        if (!token) return;
        refetchHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const queueItems = useMemo(() => songs.filter((x) => !!x.signedAudio), [songs]);

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <h2>Witaj{user ? `, ${user.userName}` : ""}!</h2>

                <button style={styles.logoutBtn} onClick={logout}>
                    Wyloguj
                </button>
            </header>

            {/* Ostatnio odtwarzane */}
            <div style={styles.section}>
                <div style={styles.sectionHeaderRow}>
                    <h3 style={styles.title}>Ostatnio odtwarzane</h3>

                    <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                        <button
                            style={styles.smallBtn}
                            onClick={refetchHistory}
                            disabled={historyLoading}
                            title="Odśwież"
                        >
                            ↻
                        </button>

                        <button
                            style={styles.smallBtnDanger}
                            onClick={async () => {
                                if (!token) return;
                                try {
                                    await clearPlayHistory(token);
                                    setHistory([]);
                                } catch (e) {
                                    setHistoryError(e.message);
                                }
                            }}
                            title="Wyczyść historię"
                        >
                            Wyczyść
                        </button>
                    </div>
                </div>

                {historyError && <div style={styles.error}>{historyError}</div>}

                {history.length === 0 && !historyLoading ? (
                    <div style={{ opacity: 0.75 }}>Brak historii odtwarzania.</div>
                ) : (
                    <div style={styles.grid}>
                        {history.map((h) => (
                            <div key={h.key} style={styles.card}>
                                <div style={styles.cardTop}>
                                    {h.signedCover ? (
                                        <img src={h.signedCover} alt="" style={styles.cover} />
                                    ) : (
                                        <div style={styles.coverPlaceholder} />
                                    )}
                                </div>

                                <div style={styles.cardBody}>
                                    <div style={styles.name} title={h.title}>
                                        {h.title}
                                    </div>

                                    <div style={{ fontSize: 12, opacity: 0.75 }}>{h.subtitle}</div>

                                    <div style={{ fontSize: 12, opacity: 0.6 }}>
                                        {new Date(h.playedAt).toLocaleString("pl-PL")}
                                    </div>

                                    <button
                                        style={{
                                            ...styles.playBtn,
                                            opacity: h.signedAudio ? 1 : 0.5,
                                            cursor: h.signedAudio ? "pointer" : "not-allowed",
                                        }}
                                        disabled={!h.signedAudio}
                                        onClick={() => {
                                            setNewQueue([h], 0);
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

            {/* Istniejące utwory */}
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
                                    ▶ Odtwórz od tego
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// helper
function mapHistoryToCard(i) {
    if (i?.type === "song" && i.song) {
        const item = mapSongToPlayerItem(i.song);
        return {
            key: `h-song-${i.historyID}`,
            playedAt: i.playedAt,
            ...item,
            subtitle: item.creatorName || "—",
        };
    }

    if (i?.type === "podcast" && i.podcast) {
        const item = mapPodcastToPlayerItem(i.podcast);
        return {
            key: `h-podcast-${i.historyID}`,
            playedAt: i.playedAt,
            ...item,
            subtitle: item.creatorName || "—",
        };
    }

    return null;
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
    logoutBtn: {
        padding: "10px 16px",
        backgroundColor: "#E53935",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        color: "white",
        fontWeight: "bold",
        marginLeft: "auto",
    },
    section: { marginBottom: "40px" },
    sectionHeaderRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
    title: { marginBottom: "15px" },

    smallBtn: {
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "#1e1e1e",
        color: "white",
        cursor: "pointer",
        fontWeight: 800,
    },
    smallBtnDanger: {
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #5a2a2a",
        background: "#2a1a1a",
        color: "white",
        cursor: "pointer",
        fontWeight: 800,
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
