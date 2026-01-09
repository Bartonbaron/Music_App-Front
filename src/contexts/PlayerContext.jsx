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

function findNextPlayable(queue, startIdx, direction = 1, isPlayableFn) {
    if (!Array.isArray(queue) || !queue.length) return null;
    if (typeof isPlayableFn !== "function") return null;

    let i = startIdx + direction;
    while (i >= 0 && i < queue.length) {
        if (isPlayableFn(queue[i])) return i;
        i += direction;
    }
    return null;
}

export function PlayerProvider({ children }) {
    const { user, token } = useAuth();

    const audioRef = useRef(new Audio());
    const prefsTimerRef = useRef(null);

    // stream counter refs
    const streamTimerRef = useRef(null);
    const countedStreamKeyRef = useRef(null);
    const STREAM_AFTER_SECONDS = 10;

    // play history refs
    const historySentKeyRef = useRef(null);
    const historySentAtRef = useRef(0);
    const historyStartedOnceRef = useRef(false);
    const HISTORY_COOLDOWN_MS = 5 * 60 * 1000;

    // stan odtwarzacza
    const [currentItem, setCurrentItem] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    // kolejka
    const [queue, setQueue] = useState([]);
    const [queueIndex, setQueueIndex] = useState(0);

    const PREV_RESTART_THRESHOLD = 2;

    // preferencje
    const [volume, setVolume] = useState(1);
    const [playbackMode, setPlaybackMode] = useState("normal"); // normal | shuffle | repeat
    const [autoplay, setAutoplay] = useState(true);

    // refs
    const queueRef = useRef([]);
    useEffect(() => {
        queueRef.current = queue;
    }, [queue]);

    const autoplayRef = useRef(true);
    useEffect(() => {
        autoplayRef.current = autoplay;
    }, [autoplay]);

    const currentItemRef = useRef(null);
    useEffect(() => {
        currentItemRef.current = currentItem;
    }, [currentItem]);

    const playbackModeRef = useRef(playbackMode);
    useEffect(() => {
        playbackModeRef.current = playbackMode;
    }, [playbackMode]);

    const originalQueueRef = useRef([]);
    const playNextRef = useRef(null);

    // helpers
    const extractSignedAudio = (item) => item?.signedAudio || item?.signedUrl || null;

    const extractSignedCover = (item) =>
        item?.signedCover || item?.coverSigned || item?.coverURL || null;

    const keyOf = (x) =>
        x?.songID ? `s:${x.songID}` : x?.podcastID ? `p:${x.podcastID}` : null;

    const canPlayItem = useCallback(
        (x) => {
            if (!x) return false;
            if (x?.isHidden) return false;
            if (x?.moderationStatus === "HIDDEN") return false;
            return !!extractSignedAudio(x);
        },
        []
    );

    // ---------------- STREAM COUNT (10s) ----------------
    const clearStreamTimer = useCallback(() => {
        if (streamTimerRef.current) {
            clearTimeout(streamTimerRef.current);
            streamTimerRef.current = null;
        }
    }, []);

    const sendStream = useCallback(
        async (item) => {
            if (!token) return;
            if (!item) return;

            const type =
                item?.type || (item?.songID ? "song" : item?.podcastID ? "podcast" : null);
            if (type !== "song") return;

            const songID = item?.songID;
            if (!songID) return;

            try {
                await fetch(`http://localhost:3000/api/songs/${songID}/stream`, {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${token}` },
                });
                // eslint-disable-next-line no-unused-vars
            } catch (_) {
                /* noop */
            }
        },
        [token]
    );

    const scheduleStreamAfter10s = useCallback(
        (item) => {
            clearStreamTimer();

            const key = keyOf(item);
            if (!key) return;

            if (countedStreamKeyRef.current === key) return;

            streamTimerRef.current = setTimeout(() => {
                const cur = currentItemRef.current;
                const stillSame = keyOf(cur) === key;

                if (stillSame && audioRef.current && !audioRef.current.paused) {
                    countedStreamKeyRef.current = key;
                    sendStream(cur);
                }
            }, STREAM_AFTER_SECONDS * 1000);
        },
        [clearStreamTimer, sendStream]
    );

    // ---------------- PLAY HISTORY ----------------
    const sendHistory = useCallback(
        async (item) => {
            if (!token) return;
            if (!item) return;

            const type =
                item?.type || (item?.songID ? "song" : item?.podcastID ? "podcast" : null);
            if (!type) return;

            const payload =
                type === "song"
                    ? item?.songID
                        ? { songID: item.songID }
                        : null
                    : item?.podcastID
                        ? { podcastID: item.podcastID }
                        : null;

            if (!payload) return;

            try {
                await fetch("http://localhost:3000/api/playhistory", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                });
                // eslint-disable-next-line no-unused-vars
            } catch (_) {
                /* noop */
            }
        },
        [token]
    );

    const safePlay = useCallback(async () => {
        try {
            await audioRef.current.play();
            setIsPlaying(true);

            const item = currentItemRef.current;
            if (item) scheduleStreamAfter10s(item);
        } catch (e) {
            setIsPlaying(false);
            console.warn("AUDIO PLAY BLOCKED:", e?.message || e);
        }
    }, [scheduleStreamAfter10s]);

    const safePause = useCallback(() => {
        audioRef.current.pause();
        setIsPlaying(false);
        clearStreamTimer();
    }, [clearStreamTimer]);

    const stopAndReset = useCallback(() => {
        const audio = audioRef.current;

        audio.pause();
        audio.currentTime = 0;

        audio.src = "";
        audio.load();

        setIsPlaying(false);
        setProgress(0);
        setDuration(0);
        setCurrentItem(null);

        setQueue([]);
        setQueueIndex(0);

        originalQueueRef.current = [];

        clearStreamTimer();
        countedStreamKeyRef.current = null;

        historyStartedOnceRef.current = false;
        historySentKeyRef.current = null;
        historySentAtRef.current = 0;
    }, [clearStreamTimer]);

    const updatePreferences = useCallback(
        (prefs) => {
            if (!token) return;

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

    const setVolumePref = useCallback((value) => {
        const v = Math.min(1, Math.max(0, Number(value)));
        if (!Number.isFinite(v)) return;
        audioRef.current.volume = v;
        setVolume(v);
    }, []);

    const applyPlaybackMode = useCallback(
        (mode, { persist = false } = {}) => {
            if (!["normal", "shuffle", "repeat"].includes(mode)) return;

            setPlaybackMode(mode);
            playbackModeRef.current = mode;

            if (persist) updatePreferences({ playbackMode: mode });

            setQueue((prevQ) => {
                if (!prevQ?.length) return prevQ;

                const playableQ = (prevQ || []).filter(canPlayItem);

                const cur = currentItemRef.current;

                const findIdx = (arr) => {
                    if (!cur) return -1;
                    return arr.findIndex(
                        (x) =>
                            (cur.songID && x.songID === cur.songID) ||
                            (cur.podcastID && x.podcastID === cur.podcastID)
                    );
                };

                if (mode === "shuffle") {
                    if (!originalQueueRef.current?.length) {
                        originalQueueRef.current = [...playableQ];
                    }

                    const idx = findIdx(playableQ);

                    if (idx < 0) {
                        const shuffled = shuffleArray(playableQ);
                        setQueueIndex(0);
                        return shuffled;
                    }

                    const selected = playableQ[idx];
                    const rest = playableQ.filter((_, i) => i !== idx);
                    const nextQ = [selected, ...shuffleArray(rest)];

                    setQueueIndex(0);
                    return nextQ;
                }

                // normal / repeat
                const baseRaw = originalQueueRef.current?.length
                    ? originalQueueRef.current
                    : playableQ;

                const base = (baseRaw || []).filter(canPlayItem);

                const idx = findIdx(base);
                setQueueIndex(idx >= 0 ? idx : 0);
                return base;
            });
        },
        [updatePreferences]
    );

    const setPlaybackModePref = useCallback(
        (mode) => {
            applyPlaybackMode(mode, { persist: false });
        },
        [applyPlaybackMode]
    );

    const setAutoplayPref = useCallback((flag) => {
        const next = Boolean(flag);
        setAutoplay(next);
        autoplayRef.current = next;
    }, []);

    useEffect(() => {
        if (!user) return;

        if (typeof user.volume === "number") {
            setVolumePref(user.volume);
        }

        if (user.playbackMode) {
            setPlaybackModePref(user.playbackMode);
        }

        if (typeof user.autoplay === "boolean") {
            setAutoplayPref(user.autoplay);
        } else if (typeof user.autoplay === "number") {
            setAutoplayPref(Boolean(user.autoplay));
        }
    }, [user, setVolumePref, setPlaybackModePref, setAutoplayPref]);

    // loadItem
    const loadSeqRef = useRef(0);

    const loadItem = useCallback(
        async (item, autoPlay = autoplayRef.current) => {
            const signedAudio = extractSignedAudio(item);

            if (!signedAudio) return;

            const audio = audioRef.current;
            const seq = ++loadSeqRef.current;

            audio.pause();
            setIsPlaying(false);

            clearStreamTimer();
            countedStreamKeyRef.current = null;

            historyStartedOnceRef.current = false;
            historySentKeyRef.current = null;
            historySentAtRef.current = 0;

            audio.src = signedAudio;
            audio.currentTime = 0;

            setProgress(0);
            setDuration(0);
            setCurrentItem({
                ...item,
                signedAudio,
                signedCover: extractSignedCover(item),
            });

            const waitForMetadata = () =>
                new Promise((resolve) => {
                    if (Number.isFinite(audio.duration) && audio.duration > 0) return resolve();

                    let done = false;
                    let t = null;

                    const cleanup = () => {
                        if (done) return;
                        done = true;
                        audio.removeEventListener("loadedmetadata", onMeta);
                        audio.removeEventListener("durationchange", onMeta);
                        audio.removeEventListener("error", onErr);
                        if (t) clearTimeout(t);
                        resolve();
                    };

                    const onMeta = () => cleanup();
                    const onErr = () => cleanup();

                    audio.addEventListener("loadedmetadata", onMeta);
                    audio.addEventListener("durationchange", onMeta);
                    audio.addEventListener("error", onErr);

                    t = setTimeout(() => cleanup(), 1500);
                    audio.load();
                });

            await waitForMetadata();

            if (seq !== loadSeqRef.current) return;

            if (Number.isFinite(audio.duration) && audio.duration > 0) {
                setDuration(audio.duration);
            }

            if (autoPlay) {
                await safePlay();
            }
        },
        [safePlay, clearStreamTimer]
    );

    const playNext = useCallback(() => {
        setQueueIndex((prev) => {
            const q = queueRef.current;
            if (!q.length) return prev;

            const targetIdx = findNextPlayable(q, prev, +1, canPlayItem);

            if (targetIdx == null) {
                audioRef.current.pause();
                setIsPlaying(false);
                clearStreamTimer();
                return prev;
            }

            loadItem(q[targetIdx], autoplayRef.current);
            return targetIdx;
        });
    }, [loadItem, clearStreamTimer, canPlayItem]);

    const playPrevious = useCallback(() => {
        const audio = audioRef.current;

        if (audio && Number.isFinite(audio.currentTime) && audio.currentTime > PREV_RESTART_THRESHOLD) {
            audio.currentTime = 0;
            setProgress(0);

            clearStreamTimer();
            countedStreamKeyRef.current = null;

            if (!audio.paused && currentItemRef.current) {
                scheduleStreamAfter10s(currentItemRef.current);
            }

            historyStartedOnceRef.current = true;
            return;
        }

        setQueueIndex((prev) => {
            const q = queueRef.current;
            if (!q.length) return prev;

            const targetIdx = findNextPlayable(q, prev, -1, canPlayItem);

            // jeśli nie ma odtwarzalnego w lewo: zostań na bieżącym
            if (targetIdx == null) {
                loadItem(q[prev], autoplayRef.current);
                return prev;
            }

            loadItem(q[targetIdx], autoplayRef.current);
            return targetIdx;
        });
    }, [loadItem, clearStreamTimer, scheduleStreamAfter10s, canPlayItem]);

    useEffect(() => {
        playNextRef.current = playNext;
    }, [playNext]);

    const setNewQueue = useCallback(
        (items, startIndex = 0) => {
            if (!Array.isArray(items) || items.length === 0) return;

            const playable = items.filter(canPlayItem);
            if (!playable.length) return;

            const safeIndex = Math.min(Math.max(0, startIndex), items.length - 1);
            const selectedFromItems = items[safeIndex];

            const selectedKey = keyOf(selectedFromItems);

            const selectedIndexPlayable = selectedKey
                ? playable.findIndex((x) => keyOf(x) === selectedKey)
                : -1;

            const selected =
                selectedIndexPlayable >= 0 ? playable[selectedIndexPlayable] : playable[0];

            let finalQueue = [...playable];

            originalQueueRef.current = [...finalQueue];

            if (playbackModeRef.current === "shuffle") {
                const selKey = keyOf(selected);
                const rest = selKey
                    ? finalQueue.filter((x) => keyOf(x) !== selKey)
                    : finalQueue.slice(1);

                finalQueue = [selected, ...shuffleArray(rest)];

                setQueue(finalQueue);
                setQueueIndex(0);
                loadItem(finalQueue[0], autoplayRef.current);
                return;
            }

            const startIdx = selectedKey
                ? finalQueue.findIndex((x) => keyOf(x) === selectedKey)
                : 0;

            const idx = startIdx >= 0 ? startIdx : 0;

            setQueue(finalQueue);
            setQueueIndex(idx);
            loadItem(finalQueue[idx], autoplayRef.current);
        },
        [loadItem]
    );

    // eventy audio
    useEffect(() => {
        const audio = audioRef.current;

        const onTimeUpdate = () => setProgress(audio.currentTime || 0);

        const onLoadedMetadata = () => {
            const d = Number.isFinite(audio.duration) ? audio.duration : 0;
            setDuration(d);
        };

        const onEnded = async () => {
            clearStreamTimer();
            countedStreamKeyRef.current = null;

            historyStartedOnceRef.current = false;

            if (playbackModeRef.current === "repeat") {
                audio.currentTime = 0;
                await safePlay();
                return;
            }
            playNextRef.current?.();
        };

        const onPlay = () => {
            setIsPlaying(true);

            const item = currentItemRef.current;
            if (!item) return;

            scheduleStreamAfter10s(item);

            if (historyStartedOnceRef.current) return;

            const key = keyOf(item);
            if (!key) return;

            const now = Date.now();
            const recentlySent =
                historySentKeyRef.current === key &&
                now - historySentAtRef.current < HISTORY_COOLDOWN_MS;

            if (recentlySent) {
                historyStartedOnceRef.current = true;
                return;
            }

            historySentKeyRef.current = key;
            historySentAtRef.current = now;
            historyStartedOnceRef.current = true;

            sendHistory(item);
        };

        const onPause = () => {
            setIsPlaying(false);
            clearStreamTimer();
        };

        const onError = () => {
            clearStreamTimer();
            countedStreamKeyRef.current = null;
            setIsPlaying(false);

            // spróbuj przejść do następnego playable
            playNextRef.current?.();
        };

        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("loadedmetadata", onLoadedMetadata);
        audio.addEventListener("ended", onEnded);
        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);
        audio.addEventListener("error", onError);

        return () => {
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("loadedmetadata", onLoadedMetadata);
            audio.removeEventListener("ended", onEnded);
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onPause);
            audio.removeEventListener("error", onError);
        };
    }, [safePlay, clearStreamTimer, scheduleStreamAfter10s, sendHistory]);

    // podstawowe kontrolki
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

    useEffect(() => {
        if (!token) {
            stopAndReset();
            if (prefsTimerRef.current) clearTimeout(prefsTimerRef.current);
        }
    }, [token, stopAndReset]);

    // UI kontrolki (persistują do backendu)
    const changeVolume = useCallback(
        (value) => {
            const v = Math.min(1, Math.max(0, Number(value)));
            if (!Number.isFinite(v)) return;
            setVolumePref(v);
            updatePreferences({ volume: v });
        },
        [setVolumePref, updatePreferences]
    );

    const changePlaybackMode = useCallback(
        (mode) => {
            applyPlaybackMode(mode, { persist: true });
        },
        [applyPlaybackMode]
    );

    const toggleAutoplay = useCallback(() => {
        setAutoplay((prev) => {
            const next = !prev;
            autoplayRef.current = next;
            updatePreferences({ autoplay: next });
            return next;
        });
    }, [updatePreferences]);

    useEffect(() => {
        return () => {
            const audio = audioRef.current;
            audio.pause();
            audio.src = "";
            if (prefsTimerRef.current) clearTimeout(prefsTimerRef.current);
            clearStreamTimer();
        };
    }, [clearStreamTimer]);

    const value = useMemo(
        () => ({
            audio: audioRef.current,

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

            setVolumePref,
            setPlaybackModePref,
            setAutoplayPref,

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
            setVolumePref,
            setPlaybackModePref,
            setAutoplayPref,
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