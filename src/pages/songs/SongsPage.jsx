import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Music2, Play } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { fetchSongs } from "../../api/content/songs.api.js";
import { mapSongToPlayerItem } from "../../utils/playerAdapter";

import { formatTrackDuration } from "../../utils/time";

function pickSongCover(s) {
    return s?.signedCover || s?.coverURL || null;
}

export default function SongsPage() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const { setNewQueue } = usePlayer();

    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        let alive = true;
        const ac = new AbortController();

        if (!token) {
            setLoading(false);
            setMsg("Zaloguj się, aby zobaczyć utwory.");
            setSongs([]);
            return () => {
                alive = false;
                ac.abort();
            };
        }

        setLoading(true);
        setMsg("");

        (async () => {
            try {
                let data;

                // Preferuj api helper
                try {
                    data = await fetchSongs(token);
                } catch (e) {
                    // Fallback na fetch (gdyby helper był niezsynchronizowany)
                    if (e?.name === "AbortError") return;
                    const res = await fetch("http://localhost:3000/api/songs", {
                        headers: { Authorization: `Bearer ${token}` },
                        signal: ac.signal,
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(json?.message || "Failed to fetch songs");
                    data = json;
                }

                const mapped = (Array.isArray(data) ? data : [])
                    .map(mapSongToPlayerItem)
                    .map((x) => ({
                        ...x,
                        duration: x?.raw?.duration ?? x?.duration,
                    }));

                if (!alive) return;
                setSongs(mapped);
            } catch (e) {
                if (!alive) return;
                if (e?.name === "AbortError") return;
                setMsg(e?.message || "Nie udało się pobrać utworów");
                setSongs([]);
            } finally {
                // eslint-disable-next-line no-unsafe-finally
                if (!alive) return;
                setLoading(false);
            }
        })();

        return () => {
            alive = false;
            ac.abort();
        };
    }, [token]);

    const playableItems = useMemo(() => songs.filter((s) => !!s?.signedAudio), [songs]);
    const canPlayAll = playableItems.length > 0;

    // Mapowanie ID -> index w playableItems (żeby Next/Prev działało poprawnie)
    const playableIndexById = useMemo(() => {
        const m = new Map();
        playableItems.forEach((it, i) => m.set(String(it.songID), i));
        return m;
    }, [playableItems]);

    const playAll = useCallback(() => {
        if (!playableItems.length) return;
        setNewQueue(playableItems, 0);
    }, [playableItems, setNewQueue]);

    return (
        <div style={styles.page}>
            {/* HEADER */}
            <div style={styles.header}>
                <div style={styles.hero}>
                    <Music2 style={{ width: 64, height: 64, opacity: 0.9 }} strokeWidth={2.2} />
                </div>

                <div style={{ minWidth: 0 }}>
                    <div style={styles.kicker}>UTWORY</div>
                    <h1 style={styles.h1}>Utwory</h1>
                    <div style={styles.metaLine}>
                        <span style={{ opacity: 0.85 }}>{songs.length} utw.</span>
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
                            title="Odtwórz wszystko"
                        >
                            <Play size={16} style={{ display: "block" }} /> Odtwórz wszystko
                        </button>
                    </div>
                </div>
            </div>

            {loading ? <div style={{ opacity: 0.75 }}>Ładowanie…</div> : null}
            {msg ? <div style={styles.hint}>{msg}</div> : null}

            {/* GRID */}
            <div style={styles.grid}>
                {songs.map((s, idx) => {
                    const playable = !!s?.signedAudio;

                    return (
                        <div
                            key={s.songID ?? idx}
                            style={styles.card}
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate(`/songs/${s.songID}`)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") navigate(`/songs/${s.songID}`);
                            }}
                            title={s.title || s.songName || "Utwór"}
                        >
                            <div style={styles.cardTop}>
                                {pickSongCover(s) ? (
                                    <img src={pickSongCover(s)} alt="" style={styles.coverImg} />
                                ) : (
                                    <div style={styles.coverFallback}>
                                        <Music2 size={28} style={{ opacity: 0.9 }} />
                                    </div>
                                )}
                            </div>

                            <div style={styles.cardBody}>
                                <div style={styles.name} title={s.title || s.songName || "Utwór"}>
                                    {s.title || s.songName || "Utwór"}
                                </div>

                                <div style={styles.sub} title={s.creatorName || "—"}>
                                    {s.creatorName || "—"}
                                </div>

                                <div style={styles.subSmall}>
                                    {formatTrackDuration(s?.raw?.duration ?? s?.duration)}
                                </div>

                                <button
                                    type="button"
                                    style={{
                                        ...styles.playBtn,
                                        opacity: playable ? 1 : 0.5,
                                        cursor: playable ? "pointer" : "not-allowed",
                                    }}
                                    disabled={!playable}
                                    onClick={(e) => {
                                        e.stopPropagation();

                                        const startIdx = playableIndexById.get(String(s.songID));
                                        if (startIdx == null) return;

                                        setNewQueue(playableItems, startIdx);
                                    }}
                                    title={playable ? "Odtwórz" : "Utwór niedostępny"}
                                >
                                    ▶ Odtwórz
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
        background: "#121212",
        color: "white",
        padding: "20px 40px",
        paddingBottom: 120,
    },

    header: {
        display: "flex",
        gap: 18,
        alignItems: "center",
        marginBottom: 22,
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

    kicker: { fontSize: 12, opacity: 0.7, letterSpacing: 1.2, fontWeight: 900 },
    h1: { margin: "6px 0 8px", fontSize: 38, lineHeight: 1.08 },
    metaLine: { opacity: 0.85, fontSize: 13 },

    actions: { marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" },

    primaryBtn: {
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

    hint: {
        marginBottom: 12,
        opacity: 0.75,
        fontSize: 13,
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
    coverImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },

    coverFallback: {
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #2b2b2b, #1f1f1f)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    cardBody: { padding: 12, display: "flex", flexDirection: "column", gap: 8 },

    name: { fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    sub: { fontSize: 12, opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    subSmall: { fontSize: 12, opacity: 0.6 },

    playBtn: {
        marginTop: 6,
        padding: "10px 12px",
        borderRadius: 10,
        border: "none",
        background: "#1db954",
        color: "#000",
        fontWeight: 900,
    },
};