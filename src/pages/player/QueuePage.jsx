import { useCallback, useEffect, useMemo, useState } from "react";
import { ListMusic, Play, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { mapSongToPlayerItem, mapPodcastToPlayerItem } from "../../utils/playerAdapter";

function mapQueueRowToPlayerItem(row) {
    if (!row) return null;

    if (row.type === "song" && row.song) {
        const base = mapSongToPlayerItem(row.song);
        return {
            ...base,
            type: "song",
            songID: row.songID ?? base.songID,
            title: row.title ?? base.title,
            songName: row.title ?? base.songName ?? base.title,
            creatorName: row.creatorName ?? base.creatorName ?? base.artistName ?? null,
            signedAudio: row.signedAudio ?? base.signedAudio ?? null,
            signedCover: row.signedCover ?? base.signedCover ?? null,
            queueID: row.queueID,
            position: row.position,
            isHidden: !!row.isHidden,
            moderationStatus: row.moderationStatus,
            raw: row.song,
        };
    }

    if (row.type === "podcast" && row.podcast) {
        const base = mapPodcastToPlayerItem(row.podcast);
        return {
            ...base,
            type: "podcast",
            podcastID: row.podcastID ?? base.podcastID,
            title: row.title ?? base.title,
            creatorName: row.creatorName ?? base.creatorName ?? null,
            signedAudio: row.signedAudio ?? base.signedAudio ?? null,
            signedCover: row.signedCover ?? base.signedCover ?? null,

            queueID: row.queueID,
            position: row.position,
            isHidden: !!row.isHidden,
            moderationStatus: row.moderationStatus,
            raw: row.podcast,
        };
    }

    return null;
}

export default function QueuePage() {
    const { token } = useAuth();
    const { setNewQueue } = usePlayer();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState(null);

    const refetch = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch("http://localhost:3000/api/queue", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Failed to fetch queue");

            const mapped = (data?.items || [])
                .map(mapQueueRowToPlayerItem)
                .filter(Boolean)
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

            setRows(mapped);
        } catch (e) {
            setError(e?.message || "Queue error");
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (!token) return;
        refetch();
    }, [token, refetch]);

    const playableItems = useMemo(() => rows.filter((x) => !!x?.signedAudio), [rows]);
    const canPlayAll = playableItems.length > 0;

    // map: queueID -> index w playableItems
    const playableIndexByQueueId = useMemo(() => {
        const m = new Map();
        playableItems.forEach((it, i) => m.set(String(it.queueID), i));
        return m;
    }, [playableItems]);

    const playAll = useCallback(() => {
        if (!playableItems.length) return;
        setNewQueue(playableItems, 0);
    }, [playableItems, setNewQueue]);

    const clearQueue = useCallback(async () => {
        if (!token) return;
        setError("");
        setLoading(true);
        try {
            const res = await fetch("http://localhost:3000/api/queue", {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Failed to clear queue");
            setRows([]);
        } catch (e) {
            setError(e?.message || "Failed to clear queue");
        } finally {
            setLoading(false);
        }
    }, [token]);

    const removeOne = useCallback(
        async (queueID) => {
            if (!token || !queueID) return;
            setBusyId(queueID);
            setError("");
            try {
                const res = await fetch(`http://localhost:3000/api/queue/${queueID}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.message || "Failed to remove item");
                await refetch();
            } catch (e) {
                setError(e?.message || "Remove error");
            } finally {
                setBusyId(null);
            }
        },
        [token, refetch]
    );

    const persistOrder = useCallback(
        async (nextRows) => {
            if (!token) return;

            const order = nextRows.map((r) => r.queueID);
            const res = await fetch("http://localhost:3000/api/queue/reorder", {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ order }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Failed to reorder queue");
        },
        [token]
    );

    const moveRow = useCallback(
        async (idx, dir) => {
            const next = [...rows];
            const j = idx + dir;
            if (j < 0 || j >= next.length) return;

            const tmp = next[idx];
            next[idx] = next[j];
            next[j] = tmp;

            const normalized = next.map((r, i) => ({ ...r, position: i + 1 }));

            setRows(normalized);

            try {
                await persistOrder(normalized);
            } catch (e) {
                // rollback na refetch, jeśli coś poszło nie tak
                setError(e?.message || "Reorder error");
                refetch();
            }
        },
        [rows, persistOrder, refetch]
    );

    return (
        <div style={styles.page}>
            {/* HEADER */}
            <div style={styles.header}>
                <div style={styles.hero}>
                    <ListMusic style={{ width: 64, height: 64, opacity: 0.9 }} strokeWidth={2.2} />
                </div>

                <div style={{ minWidth: 0 }}>
                    <div style={styles.kicker}>KOLEJKA</div>
                    <h1 style={styles.h1}>Kolejka odtwarzania</h1>

                    <div style={styles.metaLine}>
                        <span style={{ opacity: 0.85 }}>{rows.length} pozycji</span>
                        <span style={{ opacity: 0.65 }}> • </span>
                        <span style={{ opacity: 0.85 }}>
                            {playableItems.length} odtwarzalnych
                        </span>
                    </div>

                    <div style={styles.actions}>
                        <button
                            type="button"
                            onClick={playAll}
                            disabled={!canPlayAll}
                            style={{
                                ...styles.primaryBtn,
                                opacity: canPlayAll ? 1 : 0.6,
                                cursor: canPlayAll ? "pointer" : "not-allowed",
                            }}
                            title="Odtwórz kolejkę"
                        >
                            <Play size={16} style={{ display: "block" }} /> Odtwórz
                        </button>

                        <button
                            type="button"
                            onClick={refetch}
                            disabled={loading}
                            style={{
                                ...styles.secondaryBtn,
                                opacity: loading ? 0.6 : 1,
                                cursor: loading ? "not-allowed" : "pointer",
                            }}
                            title="Odśwież"
                        >
                            ↻ Odśwież
                        </button>

                        <button
                            type="button"
                            onClick={clearQueue}
                            disabled={loading || rows.length === 0}
                            style={{
                                ...styles.dangerBtn,
                                opacity: rows.length ? 1 : 0.6,
                                cursor: loading || !rows.length ? "not-allowed" : "pointer",
                            }}
                            title="Wyczyść kolejkę"
                        >
                            Wyczyść
                        </button>
                    </div>
                </div>
            </div>

            {error ? <div style={styles.error}>{error}</div> : null}
            {loading ? <div style={{ opacity: 0.75 }}>Ładowanie…</div> : null}

            {/* LIST */}
            <div style={styles.list}>
                {!loading && rows.length === 0 ? <div style={styles.hint}>Kolejka jest pusta</div> : null}

                {rows.map((it, idx) => {
                    const canPlay = !!it?.signedAudio;
                    const isDim = !canPlay || !!it?.isHidden;

                    const playIdx = playableIndexByQueueId.get(String(it.queueID));
                    const removeBusy = busyId === it.queueID;

                    const rowStyle = {
                        ...styles.row,
                        opacity: isDim ? 0.45 : 1,
                    };

                    return (
                        <div
                            key={it.queueID ?? `${it.type}-${it.songID || it.podcastID}-${idx}`}
                            style={rowStyle}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    if (playIdx == null) return;
                                    setNewQueue(playableItems, playIdx);
                                }}
                                disabled={playIdx == null}
                                style={{
                                    ...styles.rowPlayBtn,
                                    opacity: playIdx == null ? 0.55 : 1,
                                    cursor: playIdx == null ? "not-allowed" : "pointer",
                                }}
                                title={
                                    it.isHidden
                                        ? "Pozycja niedostępna (ukryta lub zablokowana)"
                                        : playIdx == null
                                            ? "Pozycja niedostępna"
                                            : "Odtwórz od tego"
                                }
                            >
                                ▶
                            </button>

                            <div style={styles.miniCoverWrap}>
                                {it.signedCover ? (
                                    <img src={it.signedCover} alt="" style={styles.miniCoverImg} />
                                ) : (
                                    <div style={styles.miniCoverPh} />
                                )}
                            </div>

                            <div style={styles.trackNo}>{idx + 1}.</div>

                            <div style={styles.trackMain}>
                                <div style={styles.trackTitle} title={it.title || "Pozycja"}>
                                    {it.title || "Pozycja"}
                                </div>

                                <div style={styles.trackSub} title={it.creatorName || ""}>
                                    <span style={{ opacity: 0.9 }}>
                                        {it.type === "podcast" ? "Podcast" : "Utwór"}
                                    </span>
                                    {it.creatorName ? <span> • {it.creatorName}</span> : null}
                                    {it.isHidden ? (
                                        <span style={{ opacity: 0.75 }}> • niedostępne</span>
                                    ) : null}
                                </div>
                            </div>

                            <div style={styles.tools}>
                                <button
                                    type="button"
                                    onClick={() => moveRow(idx, -1)}
                                    disabled={idx === 0}
                                    title="W górę"
                                    style={{
                                        ...styles.iconBtn,
                                        opacity: idx === 0 ? 0.35 : 1,
                                        cursor: idx === 0 ? "not-allowed" : "pointer",
                                    }}
                                >
                                    <ArrowUp size={16} />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => moveRow(idx, +1)}
                                    disabled={idx === rows.length - 1}
                                    title="W dół"
                                    style={{
                                        ...styles.iconBtn,
                                        opacity: idx === rows.length - 1 ? 0.35 : 1,
                                        cursor: idx === rows.length - 1 ? "not-allowed" : "pointer",
                                    }}
                                >
                                    <ArrowDown size={16} />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => removeOne(it.queueID)}
                                    disabled={removeBusy}
                                    title="Usuń z kolejki"
                                    style={{
                                        ...styles.iconBtnDanger,
                                        opacity: removeBusy ? 0.5 : 1,
                                        cursor: removeBusy ? "not-allowed" : "pointer",
                                    }}
                                >
                                    <Trash2 size={16} />
                                </button>
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
        backgroundColor: "#121212",
        color: "white",
        padding: "22px 40px",
    },

    header: {
        display: "flex",
        gap: 18,
        alignItems: "center",
        marginBottom: 16,
    },

    hero: {
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
    metaLine: { fontSize: 13, opacity: 0.75 },

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

    hint: { padding: "10px 0", opacity: 0.75 },

    list: { display: "flex", flexDirection: "column", gap: 10, marginTop: 16 },

    row: {
        display: "grid",
        gridTemplateColumns: "44px 52px 44px 1fr 160px",
        alignItems: "center",
        gap: 12,
        background: "#1b1b1b",
        border: "1px solid #2a2a2a",
        borderRadius: 14,
        padding: "10px 12px",
    },

    rowPlayBtn: {
        width: 40,
        height: 34,
        borderRadius: 10,
        border: "1px solid #333",
        background: "transparent",
        color: "white",
        fontWeight: 900,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
    },

    miniCoverWrap: {
        width: 52,
        height: 52,
        borderRadius: 10,
        overflow: "hidden",
        background: "#2a2a2a",
        flex: "0 0 auto",
    },
    miniCoverImg: { width: "100%", height: "100%", objectFit: "cover" },
    miniCoverPh: { width: "100%", height: "100%", background: "#2a2a2a" },

    trackNo: { opacity: 0.75, fontWeight: 900, textAlign: "right" },

    trackMain: { minWidth: 0 },
    trackTitle: { fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    trackSub: { fontSize: 12, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    tools: { display: "flex", gap: 8, justifyContent: "flex-end" },

    iconBtn: {
        height: 34,
        width: 40,
        borderRadius: 12,
        border: "1px solid #333",
        background: "transparent",
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
    },

    iconBtnDanger: {
        height: 34,
        width: 40,
        borderRadius: 12,
        border: "1px solid #5a2a2a",
        background: "#2a1a1a",
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
    },
};