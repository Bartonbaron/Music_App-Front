import { useMemo } from "react";
import { usePlayer } from "../../contexts/PlayerContext";
import { useNavigate } from "react-router-dom";
import {
    Play,
    Pause,
    StepBack,
    StepForward,
    Shuffle,
    Repeat,
    Zap,
    Music2,
    Mic2,
    Volume2,
    History,
    ListOrdered
} from "lucide-react";

function formatTime(sec) {
    if (sec == null || Number.isNaN(sec)) return "0:00";
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
}

function withDisabled(baseStyle, disabled) {
    if (!disabled) return baseStyle;
    return {
        ...baseStyle,
        opacity: 0.35,
        cursor: "not-allowed",
        pointerEvents: "auto",
    };
}

function modeBtnStyle(active, disabled) {
    const base = {
        height: 34,
        minWidth: 34,
        padding: "0 10px",
        borderRadius: 10,
        border: "1px solid #333",
        background: active ? "#1db954" : "transparent",
        color: active ? "#000" : "#fff",
        cursor: "pointer",
        fontWeight: 900,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
        gap: 6,
    };
    return withDisabled(base, disabled);
}

export default function PlayerBar() {

    const navigate = useNavigate();

    const {
        currentItem,
        isPlaying,
        progress,
        duration,
        togglePlay,
        playNext,
        playPrevious,
        seek,
        volume,
        changeVolume,

        autoplay,
        toggleAutoplay,
        playbackMode,
        changePlaybackMode,
        queue,
        queueIndex
    } = usePlayer();

    console.log("StepBack:", StepBack, "StepForward:", StepForward);

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

    const typeLabel = currentItem?.type === "podcast" ? "Podcast" : currentItem ? "Utwór" : "";

    const canInteract = !!currentItem;
    const canSeek = !!currentItem && duration > 0;

    const percent = duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;

    const hasPrev = !!currentItem;

    const hasNext = useMemo(() => {
        if (!queue?.length || queueIndex == null) return false;
        for (let i = queueIndex + 1; i < queue.length; i++) {
            if (queue[i]?.signedAudio) return true;
        }
        return false;
    }, [queue, queueIndex]);

    return (
        <div style={styles.bar}>
            {/* LEFT */}
            <div style={styles.left}>
                <div style={styles.cover}>
                    {currentItem?.signedCover ? (
                        <img
                            src={currentItem.signedCover}
                            alt="cover"
                            style={styles.coverImg}
                        />
                    ) : (
                        <div style={styles.coverPlaceholder} />
                    )}
                </div>

                <div style={styles.meta}>
                    <div style={styles.title}>{title}</div>

                    {/* subtitle: typ + autor */}
                    {currentItem ? (
                        <div style={styles.sub}>
          <span style={styles.subRow}>
            {currentItem.type === "podcast" ? (
                <Mic2 size={14} style={{ opacity: 0.85 }} />
            ) : (
                <Music2 size={14} style={{ opacity: 0.85 }} />
            )}

              <span>
              {typeLabel}
                  {currentItem.creatorName ? ` • ${currentItem.creatorName}` : ""}
            </span>
          </span>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* CENTER */}
            <div style={styles.center}>
                <div style={styles.controls}>
                    {/* Prev */}
                    <button
                        style={{ ...styles.iconBtn, ...( !hasPrev ? styles.disabledBtn : null ) }}
                        onClick={playPrevious}
                        disabled={!hasPrev}
                        title="Poprzedni"
                    >
                        <StepBack size={18} style={{ display: "block" }} stroke="#fff" />
                    </button>

                    {/* Play/Pause */}
                    <button
                        onClick={togglePlay}
                        disabled={!canInteract}
                        title={isPlaying ? "Pauza" : "Odtwórz"}
                        style={withDisabled(styles.playBtn, !canInteract)}
                    >
                        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                    </button>

                    {/* Next */}
                    <button
                        style={{ ...styles.iconBtn, ...( !hasNext ? styles.disabledBtn : null ) }}
                        onClick={playNext}
                        disabled={!hasNext}
                        title="Następny"
                    >
                        <StepForward size={18} style={{ display: "block" }} stroke="#fff" />
                    </button>

                    {/* Modes */}
                    <div style={styles.modes}>
                        <button
                            style={modeBtnStyle(playbackMode === "normal", !canInteract)}
                            onClick={() => changePlaybackMode("normal")}
                            disabled={!canInteract}
                            title="Normalny"
                        >
                            N
                        </button>

                        <button
                            style={modeBtnStyle(playbackMode === "shuffle", !canInteract)}
                            onClick={() => changePlaybackMode("shuffle")}
                            disabled={!canInteract}
                            title="Losowy"
                        >
                            <Shuffle size={16} />
                        </button>

                        <button
                            style={modeBtnStyle(playbackMode === "repeat", !canInteract)}
                            onClick={() => changePlaybackMode("repeat")}
                            disabled={!canInteract}
                            title="Zapętlenie"
                        >
                            <Repeat size={16} />
                        </button>

                        <button
                            style={modeBtnStyle(autoplay, !canInteract)}
                            onClick={toggleAutoplay}
                            disabled={!canInteract}
                            title="Automatyczne odtwarzanie"
                        >
                            <Zap size={16} />
                        </button>
                    </div>
                </div>

                {/* Timeline */}
                <div style={styles.timeline}>
                    <span style={styles.time}>{formatTime(progress)}</span>

                    <div style={styles.progressWrap}>
                        <div style={styles.progressTrack} />
                        <div style={{ ...styles.progressFill, width: `${percent}%` }} />

                        <input
                            type="range"
                            min={0}
                            max={duration || 0}
                            value={Math.min(progress || 0, duration || 0)}
                            onInput={(e) => seek(Number(e.target.value))}
                            disabled={!canSeek}
                            style={styles.progressRange}
                        />
                    </div>

                    <span style={styles.time}>{formatTime(duration)}</span>
                </div>
            </div>

            {/* RIGHT */}
            <div style={styles.right}>
                <button
                    onClick={() => navigate("/queue")}
                    title="Kolejka odtwarzania"
                    style={{
                        ...styles.iconBtn,
                        opacity: currentItem ? 1 : 0.6,
                        cursor: "pointer",
                    }}
                    type="button"
                >
                    <ListOrdered size={16} />
                </button>
                <button
                    onClick={() => navigate("/history")}
                    title="Historia odtwarzania"
                    style={{
                        ...styles.iconBtn,
                        opacity: currentItem ? 1 : 0.6,
                        cursor: "pointer",
                    }}
                    type="button"
                >
                    <History size={16} />
                </button>

                <Volume2 size={16} style={{ opacity: 0.8 }} />

                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume ?? 1}
                    onChange={(e) => changeVolume(Number(e.target.value))}
                    style={styles.volumeRange}
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
        height: 92,
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
    sub: { fontSize: 12, opacity: 0.75 },
    subRow: { display: "inline-flex", alignItems: "center", gap: 6 },

    center: { display: "flex", flexDirection: "column", gap: 6, alignItems: "center" },
    controls: {
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "center",
    },

    iconBtn: {
        height: 36,
        width: 40,
        background: "transparent",
        color: "#fff",
        border: "1px solid #333",
        borderRadius: 10,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    disabledBtn: {
        opacity: 0.35,
        cursor: "not-allowed",
    },
    playBtn: {
        height: 38,
        width: 52,
        background: "#1db954",
        color: "#000",
        border: "none",
        borderRadius: 999,
        fontWeight: 800,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    modes: {
        display: "flex",
        gap: 8,
        alignItems: "center",
        marginLeft: 6,
    },

    timeline: { display: "flex", gap: 10, alignItems: "center", width: "100%", maxWidth: 560 },
    time: { fontSize: 12, opacity: 0.75, width: 44, textAlign: "center" },

    right: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 },
    volumeRange: { width: 140 },

    progressWrap: {
        position: "relative",
        flex: 1,
        height: 10,
        borderRadius: 999,
        overflow: "hidden",
    },
    progressTrack: {
        position: "absolute",
        inset: 0,
        background: "#2a2a2a",
        zIndex: 0,
    },
    progressFill: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        background: "#1db954",
        borderRadius: 999,
        transition: "width 0.15s linear",
        zIndex: 1,
    },
    progressRange: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        margin: 0,
        opacity: 0,
        cursor: "pointer",
        zIndex: 2,
        pointerEvents: "auto",
    },
};
