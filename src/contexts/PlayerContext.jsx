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

    // stan odtwarzacza
    const [currentItem, setCurrentItem] = useState(null); // { type, songID/podcastID, signedAudio, signedCover, ... }
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    // kolejka
    const [queue, setQueue] = useState([]);
    const [queueIndex, setQueueIndex] = useState(0);

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
    const safePlay = useCallback(async () => {
        try {
            await audioRef.current.play();
            setIsPlaying(true);
        } catch (e) {
            setIsPlaying(false);
            console.warn("AUDIO PLAY BLOCKED:", e?.message || e);
        }
    }, []);

    const safePause = useCallback(() => {
        audioRef.current.pause();
        setIsPlaying(false);
    }, []);

    const extractSignedAudio = (item) =>
        item?.signedAudio ||
        item?.signedUrl ||
        item?.audioURL ||
        item?.fileURL ||
        null;

    const extractSignedCover = (item) =>
        item?.signedCover || item?.coverSigned || item?.coverURL || null;

    const keyOf = (x) =>
        x?.songID ? `s:${x.songID}` : x?.podcastID ? `p:${x.podcastID}` : null;

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
        } else if (typeof user.autoplay === "number") {
            setAutoplay(Boolean(user.autoplay));
        }
    }, [user]);

    // loadItem
    const loadSeqRef = useRef(0);

    const loadItem = useCallback(
        async (item, autoPlay = autoplayRef.current) => {
            const signedAudio = extractSignedAudio(item);
            if (!signedAudio) return;

            const audio = audioRef.current;
            const seq = ++loadSeqRef.current;

            // zatrzymaj poprzedni
            audio.pause();
            setIsPlaying(false);

            // ustaw src
            audio.src = signedAudio;
            audio.currentTime = 0;

            // reset stanu
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
        [safePlay]
    );

    // kontrolki kolejki
    const playNext = useCallback(() => {
        setQueueIndex((prev) => {
            const q = queueRef.current;
            if (!q.length) return prev;

            const nextIndex = prev + 1;

            if (nextIndex >= q.length) {
                audioRef.current.pause();
                setIsPlaying(false);
                return prev;
            }

            loadItem(q[nextIndex], autoplayRef.current);
            return nextIndex;
        });
    }, [loadItem]);

    const playPrevious = useCallback(() => {
        setQueueIndex((prev) => {
            const q = queueRef.current;
            if (!q.length) return prev;

            const prevIndex = prev - 1;

            if (prevIndex < 0) {
                loadItem(q[0], autoplayRef.current);
                return 0;
            }

            loadItem(q[prevIndex], autoplayRef.current);
            return prevIndex;
        });
    }, [loadItem]);

    useEffect(() => {
        playNextRef.current = playNext;
    }, [playNext]);

    const setNewQueue = useCallback(
        (items, startIndex = 0) => {
            if (!Array.isArray(items) || items.length === 0) return;

            const playable = items.filter((x) => !!extractSignedAudio(x));
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

            // zapamiętaj kolejność "normalną"
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
            if (playbackModeRef.current === "repeat") {
                audio.currentTime = 0;
                await safePlay();
                return;
            }
            playNextRef.current?.();
        };

        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("loadedmetadata", onLoadedMetadata);
        audio.addEventListener("ended", onEnded);

        return () => {
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("loadedmetadata", onLoadedMetadata);
            audio.removeEventListener("ended", onEnded);
        };
    }, [safePlay]);

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

    // aktualizacja preferencji (z debounce)
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

            setQueue((prevQ) => {
                if (!prevQ?.length) return prevQ;

                const cur = currentItemRef.current;

                const findIdx = (arr) => {
                    if (!cur) return -1;
                    return arr.findIndex(
                        (x) =>
                            (cur.songID && x.songID === cur.songID) ||
                            (cur.podcastID && x.podcastID === cur.podcastID)
                    );
                };

                // Włącz shuffle
                if (mode === "shuffle") {
                    // jeśli nie mamy "oryginalnej" kolejki, zapamiętaj aktualną (normalną)
                    if (!originalQueueRef.current?.length) {
                        originalQueueRef.current = [...prevQ];
                    }

                    const idx = findIdx(prevQ);

                    if (idx < 0) {
                        const shuffled = shuffleArray(prevQ);
                        setQueueIndex(0);
                        return shuffled;
                    }

                    const selected = prevQ[idx];
                    const rest = prevQ.filter((_, i) => i !== idx);
                    const nextQ = [selected, ...shuffleArray(rest)];

                    setQueueIndex(0);
                    return nextQ;
                }

                // Wyłącz shuffle (normal/repeat)
                const base = originalQueueRef.current?.length ? originalQueueRef.current : prevQ;
                const idx = findIdx(base);
                setQueueIndex(idx >= 0 ? idx : 0);
                return base;
            });
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

    // cleanup
    useEffect(() => {
        return () => {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            const audio = audioRef.current;
            audio.pause();
            audio.src = "";
            if (prefsTimerRef.current) clearTimeout(prefsTimerRef.current);
        };
    }, []);

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
