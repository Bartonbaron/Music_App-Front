import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useAuth } from "./AuthContext";

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
    const { user, token } = useAuth();

    const audioRef = useRef(new Audio());
    const prefsTimerRef = useRef(null);

    // --- player state
    const [currentItem, setCurrentItem] = useState(null); // { type: "song" | "podcast", ... , signedAudio, signedCover }
    const [isPlaying, setIsPlaying] = useState(false);

    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    // --- queue
    const [queue, setQueue] = useState([]);
    const [queueIndex, setQueueIndex] = useState(0);

    // --- preferences (from backend user model)
    const [volume, setVolume] = useState(1);
    const [playbackMode, setPlaybackMode] = useState("normal"); // normal | shuffle | repeat
    const [autoplay, setAutoplay] = useState(true);

    // ===== helpers
    const safePlay = useCallback(async () => {
        try {
            await audioRef.current.play();
            setIsPlaying(true);
        } catch (e) {
            // autoplay policies etc.
            setIsPlaying(false);
            console.warn("AUDIO PLAY BLOCKED:", e?.message || e);
        }
    }, []);

    const safePause = useCallback(() => {
        audioRef.current.pause();
        setIsPlaying(false);
    }, []);

    const extractSignedAudio = (item) => item?.signedAudio;

    // ===== apply user preferences from backend
    useEffect(() => {
        if (!user) return;

        if (typeof user.volume === "number") {
            audioRef.current.volume = user.volume;
            setVolume(user.volume);
        }

        if (user.playbackMode) {
            setPlaybackMode(user.playbackMode);
        }

        if (typeof user.autoplay === "boolean") {
            setAutoplay(user.autoplay);
        }
    }, [user]);

    // ===== audio events
    useEffect(() => {
        const audio = audioRef.current;

        const onTimeUpdate = () => setProgress(audio.currentTime || 0);

        const onLoadedMetadata = () => {
            const d = Number.isFinite(audio.duration) ? audio.duration : 0;
            setDuration(d);
        };

        const onEnded = () => {
            // repeat one
            if (playbackMode === "repeat") {
                audio.currentTime = 0;
                safePlay();
                return;
            }
            // next
            // eslint-disable-next-line react-hooks/immutability
            playNext();
        };

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);

        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("loadedmetadata", onLoadedMetadata);
        audio.addEventListener("ended", onEnded);
        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);

        return () => {
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("loadedmetadata", onLoadedMetadata);
            audio.removeEventListener("ended", onEnded);
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onPause);
        };
    }, [playbackMode, safePlay]); // playNext jest stabilny (useCallback) niżej

    // ===== core controls
    const play = useCallback(() => safePlay(), [safePlay]);
    const pause = useCallback(() => safePause(), [safePause]);

    const togglePlay = useCallback(() => {
        if (isPlaying) safePause();
        else safePlay();
    }, [isPlaying, safePause, safePlay]);

    const seek = useCallback((time) => {
        const audio = audioRef.current;
        const t = Number(time);
        if (!Number.isFinite(t)) return;

        audio.currentTime = Math.max(0, t);
        setProgress(audio.currentTime);
    }, []);

    // ===== load item
    const loadItem = useCallback(
        async (item, autoPlay = autoplay) => {
            const signedAudio = extractSignedAudio(item);
            if (!signedAudio) return;

            const audio = audioRef.current;

            // stop previous
            audio.pause();
            setIsPlaying(false);

            audio.src = signedAudio;
            audio.currentTime = 0;

            setProgress(0);
            setDuration(0);
            setCurrentItem(item);

            if (autoPlay) {
                await safePlay();
            }
        },
        [autoplay, safePlay]
    );

    // ===== queue logic
    const playNext = useCallback(() => {
        if (!queue.length) return;

        const nextIndex = queueIndex + 1;

        if (nextIndex >= queue.length) {
            // end of queue
            setIsPlaying(false);
            return;
        }

        setQueueIndex(nextIndex);
        loadItem(queue[nextIndex], autoplay);
    }, [queue, queueIndex, loadItem, autoplay]);

    const playPrevious = useCallback(() => {
        if (!queue.length) return;
        if (queueIndex <= 0) return;

        const prevIndex = queueIndex - 1;
        setQueueIndex(prevIndex);
        loadItem(queue[prevIndex], autoplay);
    }, [queue, queueIndex, loadItem, autoplay]);

    const setNewQueue = useCallback(
        (items, startIndex = 0) => {
            if (!Array.isArray(items) || items.length === 0) return;

            const safeIndex = Math.min(Math.max(0, startIndex), items.length - 1);
            const selected = items[safeIndex];

            let finalQueue = [...items];

            // UX: jeśli shuffle -> wybrany element jako pierwszy, reszta tasowana
            if (playbackMode === "shuffle") {
                const rest = finalQueue.filter((_, i) => i !== safeIndex);
                finalQueue = [selected, ...shuffleArray(rest)];
                setQueue(finalQueue);
                setQueueIndex(0);
                loadItem(finalQueue[0], autoplay);
                return;
            }

            setQueue(finalQueue);
            setQueueIndex(safeIndex);
            loadItem(finalQueue[safeIndex], autoplay);
        },
        [playbackMode, loadItem, autoplay]
    );

    // ===== preferences update (debounced)
    const updatePreferences = useCallback(
        (prefs) => {
            if (!token) return;

            // debounce (np. volume slider)
            if (prefsTimerRef.current) clearTimeout(prefsTimerRef.current);

            prefsTimerRef.current = setTimeout(async () => {
                try {
                    await fetch("http://localhost:3000/api/users/preferences", {
                        method: "PATCH",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(prefs),
                    });
                } catch (err) {
                    console.error("UPDATE PREFS ERROR:", err);
                }
            }, 250);
        },
        [token]
    );

    const changeVolume = useCallback(
        (value) => {
            const v = Math.min(1, Math.max(0, Number(value)));
            if (!Number.isFinite(v)) return;

            audioRef.current.volume = v;
            setVolume(v);
            updatePreferences({ volume: v });
        },
        [updatePreferences]
    );

    const changePlaybackMode = useCallback(
        (mode) => {
            if (!["normal", "shuffle", "repeat"].includes(mode)) return;
            setPlaybackMode(mode);
            updatePreferences({ playbackMode: mode });
        },
        [updatePreferences]
    );

    const toggleAutoplay = useCallback(() => {
        setAutoplay((prev) => {
            const next = !prev;
            updatePreferences({ autoplay: next });
            return next;
        });
    }, [updatePreferences]);

    // ===== cleanup on unmount
    useEffect(() => {
        return () => {
            const audio = audioRef.current;
            audio.pause();
            audio.src = "";
            if (prefsTimerRef.current) clearTimeout(prefsTimerRef.current);
        };
    }, []);

    const value = useMemo(
        () => ({
            // audio (public)
            audio: audioRef.current,

            // state
            currentItem,
            isPlaying,
            progress,
            duration,

            // queue
            queue,
            queueIndex,
            setNewQueue,
            playNext,
            playPrevious,

            // controls
            play,
            pause,
            togglePlay,
            seek,
            loadItem,

            // preferences
            volume,
            playbackMode,
            autoplay,
            changeVolume,
            changePlaybackMode,
            toggleAutoplay,
        }),
        [
            currentItem,
            isPlaying,
            progress,
            duration,
            queue,
            queueIndex,
            setNewQueue,
            playNext,
            playPrevious,
            play,
            pause,
            togglePlay,
            seek,
            loadItem,
            volume,
            playbackMode,
            autoplay,
            changeVolume,
            changePlaybackMode,
            toggleAutoplay,
        ]
    );

    return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlayer() {
    const ctx = useContext(PlayerContext);
    if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
    return ctx;
}

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
