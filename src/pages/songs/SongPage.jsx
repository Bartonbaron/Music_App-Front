import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Music2, Play, ArrowLeft } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";
import LikeButton from "../../components/common/LikeButton";
import { formatTrackDuration } from "../../utils/time";

function pickSongCover(song) {
    return song?.signedCover || song?.album?.signedCover || song?.effectiveCover || null;
}

export default function SongPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const { token } = useAuth();
    const { setNewQueue, currentItem, isPlaying } = usePlayer();

    const [song, setSong] = useState(null);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");

    const [toast, setToast] = useState(null);
    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1400);
    }, []);

    useEffect(() => {
        if (!token || !id) return;

        let alive = true;

        (async () => {
            setLoading(true);
            setMsg("");

            try {
                const res = await fetch(`http://localhost:3000/api/songs/${id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.message || "Failed to fetch song");

                if (alive) setSong(data);
            } catch (e) {
                if (alive) setMsg(e?.message || "Error");
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [token, id]);

    const playerItem = useMemo(() => {
        if (!song) return null;
        return {
            type: "song",
            songID: song.songID,
            songName: song.songName,
            title: song.songName,
            creatorName: song.creatorName || song?.creator?.user?.userName || null,
            signedAudio: song.signedAudio || null,
            signedCover: pickSongCover(song),
            duration: song.duration,
            raw: song,
        };
    }, [song]);

    const playable = !!playerItem?.signedAudio;

    const isNowPlaying = useMemo(() => {
        if (!currentItem || !playerItem) return false;
        return (
            currentItem.type === "song" &&
            String(currentItem.songID) === String(playerItem.songID)
        );
    }, [currentItem, playerItem]);

    const nowPlayingLabel = useMemo(() => {
        if (!isNowPlaying) return "Utwór";
        return isPlaying ? "Teraz odtwarzane" : "Wstrzymane";
    }, [isNowPlaying, isPlaying]);

    const playNow = useCallback(() => {
        if (!playerItem?.signedAudio) return;
        setNewQueue([playerItem], 0);
    }, [playerItem, setNewQueue]);

    if (!token) {
        return (
            <div style={styles.page}>
                <div style={{ opacity: 0.75 }}>Zaloguj się, aby zobaczyć utwór.</div>
            </div>
        );
    }

    if (loading) return <div style={styles.page}>Ładowanie…</div>;
    if (msg) return <div style={styles.page}>{msg}</div>;
    if (!song) return <div style={styles.page}>Nie znaleziono utworu.</div>;

    const author = song.creatorName || song?.creator?.user?.userName || "—";
    const cover = pickSongCover(song);

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
                    {cover ? (
                        <img src={cover} alt="" style={styles.coverImg} />
                    ) : (
                        <div style={styles.coverFallback}>
                            <Music2 size={58} style={{ display: "block", opacity: 0.9 }} />
                        </div>
                    )}
                </div>

                <div style={{ minWidth: 0 }}>
                    <div style={styles.kicker}>UTWÓR</div>

                    <h1 style={styles.h1} title={song.songName || "Utwór"}>
                        {song.songName || "Utwór"}
                    </h1>

                    <div style={styles.metaLine}>
                        <span style={{ opacity: 0.9 }}>{author}</span>
                        <span style={{ opacity: 0.65 }}> • </span>
                        <span style={{ opacity: 0.85 }}>{formatTrackDuration(song.duration)}</span>
                    </div>

                    <div style={styles.actions}>
                        <button
                            type="button"
                            onClick={playNow}
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

                        <LikeButton
                            songID={song.songID}
                            onToast={showToast}
                            style={styles.likeBtn}
                        />
                    </div>
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

    likeBtn: {
        width: 44,
        height: 40,
        borderRadius: 12,
    },
};