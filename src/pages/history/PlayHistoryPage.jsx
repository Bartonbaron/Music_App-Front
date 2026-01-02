import { useEffect, useMemo, useState } from "react";
import { Clock, Play } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { mapSongToPlayerItem, mapPodcastToPlayerItem } from "../../utils/playerAdapter";

function mapHistoryToPlayerItem(i) {
    if (i?.type === "song" && i.song) {
        const item = mapSongToPlayerItem(i.song);
        return { ...item, playedAt: i.playedAt, historyID: i.historyID };
    }
    if (i?.type === "podcast" && i.podcast) {
        const item = mapPodcastToPlayerItem(i.podcast);
        return { ...item, playedAt: i.playedAt, historyID: i.historyID };
    }
    return null;
}

function formatPlayedAt(dt) {
    try {
        return new Date(dt).toLocaleString("pl-PL");
    } catch {
        return "";
    }
}

function formatTotalDuration(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h} h ${m} min`;
    return `${m} min`;
}

export default function PlayHistoryPage() {
    const { token } = useAuth();
    const { setNewQueue } = usePlayer();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const refetch = async () => {
        if (!token) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`http://localhost:3000/api/playhistory`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "Failed to fetch history");

            const normalized = (data?.items || [])
                .map(mapHistoryToPlayerItem)
                .filter(Boolean)
                .filter((x) => !!x.signedAudio);

            setItems(normalized);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const clearAll = async () => {
        if (!token) return;
        setError("");
        try {
            const res = await fetch(`http://localhost:3000/api/playhistory`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "Failed to clear history");
            setItems([]);
        } catch (e) {
            setError(e.message);
        }
    };

    useEffect(() => {
        if (!token) return;
        refetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const canPlayAll = items.length > 0;

    const totalDuration = useMemo(() => {
        let sum = 0;
        for (const it of items) {
            const d = it?.raw?.duration;
            if (Number.isFinite(d)) sum += d;
        }
        return sum;
    }, [items]);

    return (
        <div style={styles.page}>
            <div style={styles.headerRow}>
                <div style={styles.headerLeft}>
                    <div style={styles.heroCover}>
                        {/* ważne: globalny css lucide ustawia 1em, więc wymuszamy rozmiar inline */}
                        <Clock
                            strokeWidth={2.2}
                            style={{
                                width: 64,
                                height: 64,
                                minWidth: 64,
                                minHeight: 64,
                                opacity: 0.9,
                            }}
                        />
                    </div>

                    <div style={{ minWidth: 0 }}>
                        <div style={styles.kicker}>HISTORIA</div>
                        <h1 style={styles.h1}>Historia odtwarzania</h1>

                        <div style={styles.meta}>
                            {items.length} {items.length === 1 ? "pozycja" : "pozycji"}
                            {totalDuration ? ` • ${formatTotalDuration(totalDuration)}` : ""}
                        </div>

                        <div style={styles.actions}>
                            <button
                                style={{
                                    ...styles.primaryBtn,
                                    opacity: canPlayAll ? 1 : 0.5,
                                    cursor: canPlayAll ? "pointer" : "not-allowed",
                                }}
                                disabled={!canPlayAll}
                                onClick={() => setNewQueue(items, 0)}
                            >
                                ▶ Odtwórz wszystko
                            </button>

                            <button style={styles.secondaryBtn} onClick={refetch} disabled={loading}>
                                ↻ Odśwież
                            </button>

                            <button
                                style={{ ...styles.dangerBtn, opacity: items.length ? 1 : 0.5 }}
                                onClick={clearAll}
                                disabled={loading || !items.length}
                            >
                                Wyczyść historię
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            {loading ? (
                <div style={{ opacity: 0.8 }}>Ładowanie…</div>
            ) : items.length === 0 ? (
                <div style={{ opacity: 0.75 }}>Brak historii odtwarzania.</div>
            ) : (
                <div style={styles.list}>
                    {items.map((it, idx) => (
                        <div
                            key={`${it.type}-${it.songID || it.podcastID}-${it.historyID || idx}`}
                            style={styles.row}
                            onClick={() => setNewQueue(items, idx)} // klik w wiersz = "odtwórz od tego"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") setNewQueue(items, idx);
                            }}
                            title="Kliknij, aby odtworzyć od tego miejsca"
                        >
                            <div style={styles.rowLeft}>
                                <div style={styles.rowCover}>
                                    {it.signedCover ? (
                                        <img src={it.signedCover} alt="" style={styles.coverImg} />
                                    ) : (
                                        <div style={styles.coverPlaceholder} />
                                    )}
                                </div>

                                <div style={styles.rowMeta}>
                                    <div style={styles.rowTitle} title={it.title}>
                                        {it.title}
                                    </div>

                                    <div style={styles.rowSub} title={it.creatorName || ""}>
                    <span style={{ opacity: 0.9 }}>
                      {it.type === "podcast" ? "Podcast" : "Utwór"}
                    </span>
                                        {it.creatorName ? <span> • {it.creatorName}</span> : null}
                                        <span style={{ opacity: 0.65 }}> • {formatPlayedAt(it.playedAt)}</span>
                                    </div>
                                </div>
                            </div>

                            <div style={styles.rowRight}>
                                <button
                                    style={styles.rowBtn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setNewQueue(items, idx);
                                    }}
                                    title="Odtwórz od tego"
                                >
                                    <Play size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* żeby lista nie wchodziła pod PlayerBar */}
            <div style={{ height: 120 }} />
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        backgroundColor: "#121212",
        color: "white",
        padding: "22px 40px",
    },

    headerRow: { marginBottom: 18 },
    headerLeft: { display: "flex", gap: 18, alignItems: "center" },

    heroCover: {
        width: 140,
        height: 140,
        borderRadius: 16,
        background: "linear-gradient(135deg, #2b2b2b, #1f1f1f)",
        border: "1px solid #2a2a2a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
    },

    kicker: { fontSize: 12, opacity: 0.7, letterSpacing: 1.4, fontWeight: 900 },
    h1: { margin: "6px 0 6px", fontSize: 34, lineHeight: 1.1 },
    meta: { fontSize: 13, opacity: 0.75 },

    actions: { marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" },

    primaryBtn: {
        padding: "10px 14px",
        borderRadius: 12,
        border: "none",
        background: "#1db954",
        color: "#000",
        fontWeight: 900,
        cursor: "pointer",
    },
    secondaryBtn: {
        padding: "10px 14px",
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "#1e1e1e",
        color: "#fff",
        fontWeight: 900,
        cursor: "pointer",
    },
    dangerBtn: {
        padding: "10px 14px",
        borderRadius: 12,
        border: "1px solid #5a2a2a",
        background: "#2a1a1a",
        color: "#fff",
        fontWeight: 900,
        cursor: "pointer",
    },

    error: {
        background: "#2a1a1a",
        border: "1px solid #5a2a2a",
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
    },

    list: {
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginTop: 16,
    },
    row: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#1b1b1b",
        border: "1px solid #2a2a2a",
        borderRadius: 14,
        padding: "10px 12px",
        gap: 12,
        cursor: "pointer",
    },
    rowLeft: { display: "flex", alignItems: "center", gap: 12, minWidth: 0 },
    rowCover: {
        width: 52,
        height: 52,
        borderRadius: 10,
        overflow: "hidden",
        background: "#2a2a2a",
        flex: "0 0 auto",
    },
    coverImg: { width: "100%", height: "100%", objectFit: "cover" },
    coverPlaceholder: { width: "100%", height: "100%", background: "#2a2a2a" },
    rowMeta: { minWidth: 0 },
    rowTitle: {
        fontWeight: 900,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    rowSub: {
        fontSize: 12,
        opacity: 0.85,
        marginTop: 2,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },

    rowRight: { display: "flex", gap: 8, flex: "0 0 auto" },
    rowBtn: {
        height: 36,
        width: 44,
        borderRadius: 12,
        border: "1px solid #333",
        background: "transparent",
        color: "#fff",
        cursor: "pointer",
        fontWeight: 900,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
        padding: 0,
    },
};