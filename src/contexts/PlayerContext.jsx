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

function findNextPlayable(queue, startIdx, direction, canPlay) {
    let i = startIdx + direction;
    while (i >= 0 && i < queue.length) {
        if (canPlay(queue[i])) return i;
        i += direction;
    }
    return null;
}

export function PlayerProvider({ children }) {
    const { user, token } = useAuth();

    const audioRef = useRef(new Audio());
    const prefsTimerRef = useRef(null);

    const streamTimerRef = useRef(null);
    const countedStreamKeyRef = useRef(null);
    const STREAM_AFTER_SECONDS = 10;

    const historySentKeyRef = useRef(null);
    const historySentAtRef = useRef(0);
    const historyStartedOnceRef = useRef(false);
    const HISTORY_COOLDOWN_MS = 5 * 60 * 1000;

    // Kolejka serwerowa (backend /api/queue)
    const [serverQueue, setServerQueue] = useState([]);
    const serverQueueRef = useRef([]);
    useEffect(() => {
        serverQueueRef.current = serverQueue;
    }, [serverQueue]);

    // upNextQueue (lokalna)
    const [upNextQueue, setUpNextQueue] = useState([]);
    const upNextQueueRef = useRef([]);
    useEffect(() => {
        upNextQueueRef.current = upNextQueue;
    }, [upNextQueue]);

    // baseQueue = album/playlist/historia
    const [baseQueue, setBaseQueue] = useState([]);
    const [baseQueueIndex, setBaseQueueIndex] = useState(0);

    const baseQueueRef = useRef([]);
    useEffect(() => {
        baseQueueRef.current = baseQueue;
    }, [baseQueue]);

    const baseQueueIndexRef = useRef(0);
    useEffect(() => {
        baseQueueIndexRef.current = baseQueueIndex;
    }, [baseQueueIndex]);

    // stan odtwarzacza
    const [currentItem, setCurrentItem] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    // "server" | "upnext" | "base"
    const currentSourceRef = useRef("base");

    // shuffle: oryginalna base kolejność
    const originalBaseQueueRef = useRef([]);

    // ostatni indeks z baseQueue (dla cofania z server/upNext)
    const lastBaseIndexRef = useRef(0);
    useEffect(() => {
        if (currentSourceRef.current === "base") {
            lastBaseIndexRef.current = baseQueueIndex;
        }
    }, [baseQueueIndex]);

    const PREV_RESTART_THRESHOLD = 2;

    // preferencje
    const [volume, setVolume] = useState(1);
    const [playbackMode, setPlaybackMode] = useState("normal"); // normal | shuffle | repeat
    const [autoplay, setAutoplay] = useState(true);

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

    const playNextRef = useRef(null);

    // helpers
    const extractSignedAudio = (item) =>
        item?.signedAudio || item?.signedUrl || item?.audioURL || item?.fileURL || null;

    const extractSignedCover = (item) =>
        item?.signedCover || item?.coverSigned || item?.coverURL || null;

    const keyOf = (x) =>
        x?.songID ? `s:${x.songID}` : x?.podcastID ? `p:${x.podcastID}` : null;

    const canPlayItem = useCallback((x) => {
        if (!x) return false;
        if (x?.isHidden) return false;
        if (x?.moderationStatus === "HIDDEN") return false;
        return !!extractSignedAudio(x);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const mapQueueRowToPlayerItem = useCallback((row) => {
        if (!row) return null;

        if (row.type === "song" && row.song) {
            const s = row.song;
            return {
                type: "song",
                queueID: row.queueID,
                songID: s.songID,
                songName: s.songName,
                creatorName: s.creatorName || s?.creator?.user?.userName || null,
                duration: s.duration,
                signedAudio: row.signedAudio || null,
                signedCover: row.signedCover || null,
                moderationStatus: s.moderationStatus,
                isHidden: s.moderationStatus === "HIDDEN",
                raw: s,
            };
        }

        if (row.type === "podcast" && row.podcast) {
            const p = row.podcast;
            return {
                type: "podcast",
                queueID: row.queueID,
                podcastID: p.podcastID,
                title: p.title || p.podcastName || `Podcast ${p.podcastID}`,
                creatorName: p.creatorName || p?.creator?.user?.userName || null,
                duration: p.duration,
                signedAudio: row.signedAudio || null,
                signedCover: row.signedCover || null,

                // podcast zwykle nie ma moderationStatus -> NIE blokujemy przez to
                moderationStatus: p.moderationStatus,
                isHidden: p.moderationStatus === "HIDDEN",

                raw: p,
            };
        }

        return null;
    }, []);

    // API kolejki serwera
    const refetchServerQueue = useCallback(async () => {
        if (!token) {
            setServerQueue([]);
            return;
        }
        try {
            const res = await fetch("http://localhost:3000/api/queue", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Failed to fetch queue");

            const normalized = (data?.items || [])
                .map(mapQueueRowToPlayerItem)
                .filter(Boolean);

            setServerQueue(normalized);
        } catch (e) {
            console.warn("refetchServerQueue error:", e?.message || e);
        }
    }, [token, mapQueueRowToPlayerItem]);

    const removeServerQueueItem = useCallback(
        async (queueID) => {
            if (!token || !queueID) return;
            try {
                await fetch(`http://localhost:3000/api/queue/${queueID}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                });
                // eslint-disable-next-line no-unused-vars
            } catch (_) {
                /* noop */
            }
        },
        [token]
    );

    const clearServerQueue = useCallback(async () => {
        if (!token) return;
        try {
            await fetch("http://localhost:3000/api/queue", {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            setServerQueue([]);
            // eslint-disable-next-line no-unused-vars
        } catch (_) {
            /* noop */
        }
    }, [token]);

    // enqueue do backendu (mode: END | NEXT)
    const enqueueServer = useCallback(
        async ({ songID, podcastID, mode }) => {
            if (!token) return;

            const body = {
                mode: mode || "END",
                songID: songID != null ? Number(songID) : undefined,
                podcastID: podcastID != null ? Number(podcastID) : undefined,
            };

            try {
                const res = await fetch("http://localhost:3000/api/queue", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.message || "Failed to add to queue");

                await refetchServerQueue();
                return data;
            } catch (e) {
                console.warn("enqueueServer error:", e?.message || e);
                return { success: false, message: e?.message || "Failed" };
            }
        },
        [token, refetchServerQueue]
    );

    const enqueueServerEndSong = useCallback(
        (songID) => enqueueServer({ songID, mode: "END" }),
        [enqueueServer]
    );
    const enqueueServerNextSong = useCallback(
        (songID) => enqueueServer({ songID, mode: "NEXT" }),
        [enqueueServer]
    );
    const enqueueServerEndPodcast = useCallback(
        (podcastID) => enqueueServer({ podcastID, mode: "END" }),
        [enqueueServer]
    );
    const enqueueServerNextPodcast = useCallback(
        (podcastID) => enqueueServer({ podcastID, mode: "NEXT" }),
        [enqueueServer]
    );

    useEffect(() => {
        if (!token) return;
        refetchServerQueue();
    }, [token, refetchServerQueue]);

    // Liczenie odtworzeń (10s)
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

        setBaseQueue([]);
        setBaseQueueIndex(0);
        setUpNextQueue([]);
        setServerQueue([]);

        originalBaseQueueRef.current = [];

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

            setBaseQueue((prevQ) => {
                if (!prevQ?.length) return prevQ;

                const filteredQ = prevQ.filter(canPlayItem);
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
                    if (!originalBaseQueueRef.current?.length) {
                        originalBaseQueueRef.current = [...filteredQ];
                    }

                    const idx = findIdx(filteredQ);

                    if (idx < 0) {
                        const shuffled = shuffleArray(filteredQ);
                        setBaseQueueIndex(0);
                        return shuffled;
                    }

                    const selected = filteredQ[idx];
                    const rest = filteredQ.filter((_, i) => i !== idx);
                    const nextQ = [selected, ...shuffleArray(rest)];

                    setBaseQueueIndex(0);
                    return nextQ;
                }

                const baseRaw = originalBaseQueueRef.current?.length
                    ? originalBaseQueueRef.current
                    : filteredQ;

                const base = baseRaw.filter(canPlayItem);
                const idx = findIdx(base);
                setBaseQueueIndex(idx >= 0 ? idx : 0);
                return base;
            });
        },
        [updatePreferences, canPlayItem]
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
            if (!canPlayItem(item)) {
                playNextRef.current?.();
                return;
            }

            const signedAudio = extractSignedAudio(item);
            if (!signedAudio) {
                playNextRef.current?.();
                return;
            }

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
        [safePlay, clearStreamTimer, canPlayItem]
    );

    // serverQueue: wybierz pierwsze dostępne (FIFO)
    const consumeFirstServerQueueItem = useCallback(async () => {
        const q = serverQueueRef.current || [];
        const idx = q.findIndex((it) => canPlayItem(it));
        if (idx < 0) return null;

        const picked = q[idx];

        setServerQueue((prev) => prev.slice(idx + 1));

        if (picked?.queueID) removeServerQueueItem(picked.queueID);

        return picked;
    }, [canPlayItem, removeServerQueueItem]);

    // playNext: serverQueue -> upNextQueue -> baseQueue
    const playNext = useCallback(async () => {
        // 1) serverQueue (lokalnie)
        let fromServer = await consumeFirstServerQueueItem();

        if (!fromServer && token) {
            await refetchServerQueue();
            fromServer = await consumeFirstServerQueueItem();
        }

        if (fromServer) {
            lastBaseIndexRef.current = baseQueueIndexRef.current ?? 0;

            currentSourceRef.current = "server";
            loadItem(fromServer, autoplayRef.current);
            return;
        }

        // 2) upNext (lokalna)
        const up = upNextQueueRef.current || [];
        const firstUpIdx = up.findIndex((x) => canPlayItem(x));
        if (firstUpIdx >= 0) {
            const nextItem = up[firstUpIdx];
            setUpNextQueue(up.slice(firstUpIdx + 1));

            lastBaseIndexRef.current = baseQueueIndexRef.current ?? 0;

            currentSourceRef.current = "upnext";
            loadItem(nextItem, autoplayRef.current);
            return;
        }

        // 3) baseQueue
        const bq = baseQueueRef.current || [];
        if (!bq.length) {
            audioRef.current.pause();
            setIsPlaying(false);
            clearStreamTimer();
            return;
        }

        const curIdx = baseQueueIndexRef.current ?? 0;
        const targetIdx = findNextPlayable(bq, curIdx, +1, canPlayItem);

        if (targetIdx == null) {
            audioRef.current.pause();
            setIsPlaying(false);
            clearStreamTimer();
            return;
        }

        currentSourceRef.current = "base";
        setBaseQueueIndex(targetIdx);

        baseQueueIndexRef.current = targetIdx;
        lastBaseIndexRef.current = targetIdx;

        loadItem(bq[targetIdx], autoplayRef.current);
    }, [
        token,
        refetchServerQueue,
        consumeFirstServerQueueItem,
        loadItem,
        clearStreamTimer,
        canPlayItem,
    ]);

    const playPrevious = useCallback(() => {
        const audio = audioRef.current;
        const bq = baseQueueRef.current || [];

        // 1) Jeśli aktualnie gramy z kolejki (server/upnext) -> PREV wraca do baseQueue
        if ((currentSourceRef.current === "server" || currentSourceRef.current === "upnext") && bq.length) {
            const idx = Math.min(Math.max(0, lastBaseIndexRef.current ?? 0), bq.length - 1);

            currentSourceRef.current = "base";
            setBaseQueueIndex(idx);

            baseQueueIndexRef.current = idx;

            loadItem(bq[idx], autoplayRef.current);
            return;
        }

        // 2) Standard: jeśli > 2s to restart bieżącego (dotyczy base)
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

        if (!bq.length) return;

        const curIdx = baseQueueIndexRef.current ?? 0;

        // 3) Normalne cofanie w baseQueue
        const targetIdx = findNextPlayable(bq, curIdx, -1, canPlayItem);

        if (targetIdx == null) {
            const current = bq[curIdx];
            if (current && canPlayItem(current)) loadItem(current, autoplayRef.current);
            return;
        }

        setBaseQueueIndex(targetIdx);

        baseQueueIndexRef.current = targetIdx;
        lastBaseIndexRef.current = targetIdx;

        loadItem(bq[targetIdx], autoplayRef.current);
    }, [loadItem, clearStreamTimer, scheduleStreamAfter10s, canPlayItem]);

    useEffect(() => {
        playNextRef.current = playNext;
    }, [playNext]);

    // setNewQueue (ustawia baseQueue)
    const setNewQueue = useCallback(
        (items, startIndex = 0) => {
            if (!Array.isArray(items) || items.length === 0) return;

            const filtered = items.filter(canPlayItem);
            if (!filtered.length) return;

            const safeIndex = Math.min(Math.max(0, startIndex), items.length - 1);
            const selectedFromItems = items[safeIndex];

            const selectedKey = keyOf(selectedFromItems);
            const selectedIndex = selectedKey
                ? filtered.findIndex((x) => keyOf(x) === selectedKey)
                : -1;

            const selected = selectedIndex >= 0 ? filtered[selectedIndex] : filtered[0];

            let finalQueue = [...filtered];
            originalBaseQueueRef.current = [...finalQueue];

            if (playbackModeRef.current === "shuffle") {
                const selKey = keyOf(selected);
                const rest = selKey ? finalQueue.filter((x) => keyOf(x) !== selKey) : finalQueue.slice(1);
                finalQueue = [selected, ...shuffleArray(rest)];
                setBaseQueue(finalQueue);
                setBaseQueueIndex(0);

                baseQueueRef.current = finalQueue;
                baseQueueIndexRef.current = 0;
                lastBaseIndexRef.current = 0;

                currentSourceRef.current = "base";
                loadItem(finalQueue[0], autoplayRef.current);
                return;
            }

            const startIdx = selectedKey ? finalQueue.findIndex((x) => keyOf(x) === selectedKey) : 0;
            const idx = startIdx >= 0 ? startIdx : 0;

            setBaseQueue(finalQueue);
            setBaseQueueIndex(idx);

            baseQueueRef.current = finalQueue;
            baseQueueIndexRef.current = idx;
            lastBaseIndexRef.current = idx;

            currentSourceRef.current = "base";
            loadItem(finalQueue[idx], autoplayRef.current);
        },
        [loadItem, canPlayItem]
    );

    // enqueueEnd / enqueueNext (lokalne)
    const enqueueEnd = useCallback((item) => {
        if (!item) return;
        setUpNextQueue((prev) => [...prev, item]);
    }, []);

    const enqueueNext = useCallback((item) => {
        if (!item) return;
        setUpNextQueue((prev) => [item, ...prev]);
    }, []);

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

            // baseQueue
            queue: baseQueue,
            baseQueue,
            queueIndex: baseQueueIndex,
            setNewQueue,

            // nav
            playNext,
            playPrevious,

            // local upNext
            upNextQueue,
            enqueueEnd,
            enqueueNext,

            // server queue
            serverQueue,
            refetchServerQueue,
            clearServerQueue,
            removeServerQueueItem,

            enqueueServerEndSong,
            enqueueServerNextSong,
            enqueueServerEndPodcast,
            enqueueServerNextPodcast,

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
            baseQueue,
            baseQueueIndex,
            setNewQueue,
            playNext,
            playPrevious,
            upNextQueue,
            enqueueEnd,
            enqueueNext,
            serverQueue,
            refetchServerQueue,
            clearServerQueue,
            removeServerQueueItem,
            enqueueServerEndSong,
            enqueueServerNextSong,
            enqueueServerEndPodcast,
            enqueueServerNextPodcast,
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