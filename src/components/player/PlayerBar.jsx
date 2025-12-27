import { useEffect, useMemo, useState } from "react";
import { usePlayer } from "../../contexts/PlayerContext";

function formatTime(sec) {
    if (sec == null || Number.isNaN(sec)) return "0:00";
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
}

export default function PlayerBar() {
    const {
        audio,
        currentItem,
        isPlaying,
        progress,
        togglePlay,
        playNext,
        playPrevious,
        seek,
        volume,
        changeVolume,
    } = usePlayer();

    const [durationState, setDurationState] = useState(0);

    useEffect(() => {
        if (!audio) return;

        const updateDuration = () => {
            const d = Number.isFinite(audio.duration) ? audio.duration : 0;
            setDurationState(d);
        };

        audio.addEventListener("loadedmetadata", updateDuration);
        audio.addEventListener("durationchange", updateDuration);

        // na wypadek gdyby metadane były już dostępne
        updateDuration();

        return () => {
            audio.removeEventListener("loadedmetadata", updateDuration);
            audio.removeEventListener("durationchange", updateDuration);
        };
    }, [audio]);


    const title = useMemo(() => {
        if (!currentItem) return "Nic nie gra";
        return (
            currentItem.songName ||
            currentItem.podcastName ||
            currentItem.title ||
            currentItem.name ||
            "Odtwarzanie"
        );
    }, [currentItem]);

    const duration = durationState;

    const percent = duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;

    return (
        <div style={styles.bar}>
            <div style={styles.left}>
                <div style={styles.cover}>
                    {currentItem?.signedCover ? (
                        <img src={currentItem.signedCover} alt="cover" style={styles.coverImg} />
                    ) : (
                        <div style={styles.coverPlaceholder} />
                    )}
                </div>

                <div style={styles.meta}>
                    <div style={styles.title}>{title}</div>
                    <div style={styles.sub}>
                        {currentItem ? (currentItem.type === "podcast" ? "Podcast" : "Utwór") : ""}
                    </div>
                </div>
            </div>

            <div style={styles.center}>
                <div style={styles.controls}>
                    <button style={styles.ctrlBtn} onClick={playPrevious} disabled={!currentItem}>
                        ⏮
                    </button>

                    <button style={styles.playBtn} onClick={togglePlay} disabled={!currentItem}>
                        {isPlaying ? "⏸" : "▶"}
                    </button>

                    <button style={styles.ctrlBtn} onClick={playNext} disabled={!currentItem}>
                        ⏭
                    </button>
                </div>

                <div style={styles.timeline}>
                    <span style={styles.time}>{formatTime(progress)}</span>

                    <div style={styles.progressWrap}>
                        {/* wizualne wypełnienie */}
                        <div
                            style={{
                                ...styles.progressFill,
                                width: `${percent}%`,
                            }}
                        />

                        {/* suwak do seekowania (nakładka) */}
                        <input
                            type="range"
                            min={0}
                            max={duration || 0}
                            value={Math.min(progress || 0, duration || 0)}
                            onChange={(e) => seek(Number(e.target.value))}
                            disabled={!currentItem || !duration}
                            style={styles.progressRange}
                        />
                    </div>

                    <span style={styles.time}>{formatTime(duration)}</span>
                </div>

            </div>

            <div style={styles.right}>
                <span style={{ opacity: 0.8 }}>🔊</span>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume ?? 1}
                    onChange={(e) => changeVolume(Number(e.target.value))}
                    style={{ width: 140 }}
                />
            </div>
        </div>
    );
}

const styles = {
    bar: {
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: 80,
        background: "#181818",
        borderTop: "1px solid #2a2a2a",
        display: "grid",
        gridTemplateColumns: "1fr 2fr 1fr",
        alignItems: "center",
        padding: "10px 16px",
        gap: 12,
        zIndex: 50,
    },
    left: { display: "flex", alignItems: "center", gap: 12 },
    cover: { width: 54, height: 54, borderRadius: 8, overflow: "hidden", background: "#2a2a2a" },
    coverImg: { width: "100%", height: "100%", objectFit: "cover" },
    coverPlaceholder: { width: "100%", height: "100%", background: "#2a2a2a" },
    meta: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
    title: { fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    sub: { fontSize: 12, opacity: 0.7 },

    center: { display: "flex", flexDirection: "column", gap: 6, alignItems: "center" },
    controls: { display: "flex", gap: 10, alignItems: "center" },
    ctrlBtn: {
        padding: "6px 10px",
        background: "transparent",
        color: "white",
        border: "1px solid #333",
        borderRadius: 8,
        cursor: "pointer",
    },
    playBtn: {
        padding: "8px 14px",
        background: "#1db954",
        color: "#000",
        border: "none",
        borderRadius: 999,
        fontWeight: 800,
        cursor: "pointer",
        minWidth: 56,
    },

    timeline: { display: "flex", gap: 10, alignItems: "center", width: "100%", maxWidth: 520 },
    time: { fontSize: 12, opacity: 0.75, width: 44, textAlign: "center" },
    range: { flex: 1 },

    right: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 },

    progressWrap: {
        position: "relative",
        flex: 1,
        height: 10,
        borderRadius: 999,
        background: "#2a2a2a",
        overflow: "hidden",
    },

    progressFill: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        background: "#1db954",
        borderRadius: 999,
        transition: "width 0.15s linear", // “płynne przesuwanie”
    },

    progressRange: {
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        margin: 0,
        opacity: 0,
        cursor: "pointer",
    },
};
