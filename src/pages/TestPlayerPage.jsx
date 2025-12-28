import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { usePlayer } from "../contexts/PlayerContext";

export default function TestPlayerPage() {
    const { token } = useAuth();
    const {
        loadItem,
        setNewQueue,
        playNext,
        playPrevious,
        currentItem,
        isPlaying,
        queue,
        queueIndex,
        progress,
        duration,
        playbackMode,
        changePlaybackMode,
        autoplay,
        toggleAutoplay,
    } = usePlayer();

    const [songs, setSongs] = useState([]);
    const [podcasts, setPodcasts] = useState([]);
    const [albums, setAlbums] = useState([]);
    const [albumSongs, setAlbumSongs] = useState([]);

    const [selectedAlbumID, setSelectedAlbumID] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    // --- helpers: fetch
    const apiGet = async (path) => {
        const res = await fetch(`http://localhost:3000${path}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `Failed: ${path}`);
        return data;
    };

    const refresh = async () => {
        setLoading(true);
        setMsg("");
        try {
            const [s, p, a] = await Promise.all([
                apiGet("/api/songs"),
                apiGet("/api/podcasts"),
                apiGet("/api/albums"), // <- dopasuj jeśli masz inną trasę
            ]);

            const songsArr = Array.isArray(s) ? s : s.songs || [];
            const podcastsArr = Array.isArray(p) ? p : p.podcasts || [];
            const albumsArr = Array.isArray(a) ? a : a.albums || [];

            setSongs(songsArr);
            setPodcasts(podcastsArr);
            setAlbums(albumsArr);

            setMsg(`OK: songs=${songsArr.length}, podcasts=${podcastsArr.length}, albums=${albumsArr.length}`);
        } catch (e) {
            setMsg(e.message || "Error");
        } finally {
            setLoading(false);
        }
    };

    const loadAlbumSongs = async (albumID) => {
        if (!albumID) return;
        setLoading(true);
        setMsg("");
        try {
            const data = await apiGet(`/api/albums/${albumID}/songs`);
            const arr = Array.isArray(data) ? data : data.songs || data.items || [];
            setAlbumSongs(arr);
            setMsg(`OK: albumSongs=${arr.length} (albumID=${albumID})`);
        } catch (e) {
            setAlbumSongs([]);
            setMsg(e.message || "Album songs error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!token) return;
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const normalizeItem = (item, type) => ({
        ...item,
        type,
        signedAudio: item?.signedAudio || item?.signedUrl || item?.fileURL || item?.audioURL || null,
        signedCover: item?.signedCover || item?.coverURL || null,
    });

    const normalizeSong = (song) => ({
        ...song,
        type: "song",
        signedAudio: song.signedAudio || song.signedUrl || song.audioSignedUrl || null,
        signedCover: song.signedCover || song.coverSignedUrl || null,
    });


    const normalizedSongs = useMemo(
        () => songs.map((s) => normalizeItem(s, "song")).filter((x) => x.signedAudio),
        [songs]
    );

    const normalizedPodcasts = useMemo(
        () => podcasts.map((p) => normalizeItem(p, "podcast")).filter((x) => x.signedAudio),
        [podcasts]
    );

    const normalizedAlbumSongs = useMemo(
        () => albumSongs.map(normalizeSong).filter((x) => x.signedAudio),
        [albumSongs]
    );

    // --- actions
    const playFirstSong = async () => {
        if (!normalizedSongs.length) return setMsg("Brak utworów z signedAudio");
        await loadItem(normalizedSongs[0], true);
        setMsg("OK: loadItem(song[0])");
    };

    const playSongQueue3 = () => {
        const items = normalizedSongs.slice(0, 3);
        if (!items.length) return setMsg("Brak signedAudio w songs");
        setNewQueue(items, 0);
        setMsg(`OK: setNewQueue(songs[0..${items.length - 1}])`);
    };

    const playFirstPodcast = async () => {
        if (!normalizedPodcasts.length) return setMsg("Brak podcastów z signedAudio");
        await loadItem(normalizedPodcasts[0], true);
        setMsg("OK: loadItem(podcast[0])");
    };

    const playMixedQueue = () => {
        const items = [
            ...normalizedSongs.slice(0, 2),
            ...normalizedPodcasts.slice(0, 1),
        ].filter(Boolean);

        if (!items.length) return setMsg("Brak elementów do mixed queue");
        setNewQueue(items, 0);
        setMsg(`OK: mixed queue (${items.length})`);
    };

    const setAlbumQueue = (startIndex = 0) => {
        if (!normalizedAlbumSongs.length) return setMsg("Album nie ma tracków z signedAudio");
        setNewQueue(normalizedAlbumSongs, startIndex);
        setMsg(`OK: setNewQueue(albumSongs, startIndex=${startIndex})`);
    };

    return (
        <div style={styles.page}>
            <h2 style={{ marginTop: 0 }}>Test Playera (songs / podcasts / albums)</h2>

            <div style={styles.row}>
                <button style={styles.btn} onClick={refresh} disabled={loading || !token}>
                    {loading ? "Ładowanie..." : "Odśwież listy"}
                </button>

                <div style={{ opacity: 0.85 }}>
                    {msg && <span>{msg}</span>}
                </div>
            </div>

            {/* Preferences */}
            <div style={styles.card}>
                <h3>Preferencje playera</h3>
                <div style={styles.row}>
                    <button
                        style={styles.btn}
                        onClick={() => changePlaybackMode("normal")}
                        disabled={playbackMode === "normal"}
                    >
                        Mode: normal
                    </button>
                    <button
                        style={styles.btn}
                        onClick={() => changePlaybackMode("shuffle")}
                        disabled={playbackMode === "shuffle"}
                    >
                        Mode: shuffle
                    </button>
                    <button
                        style={styles.btn}
                        onClick={() => changePlaybackMode("repeat")}
                        disabled={playbackMode === "repeat"}
                    >
                        Mode: repeat
                    </button>
                    <button style={styles.btn} onClick={toggleAutoplay}>
                        autoplay: {autoplay ? "ON" : "OFF"}
                    </button>
                </div>
            </div>

            <div style={styles.grid}>
                <div style={styles.card}>
                    <h3>Song testy</h3>
                    <button style={styles.btn} onClick={playFirstSong} disabled={!normalizedSongs.length}>
                        ▶ loadItem 1st song
                    </button>
                    <button style={styles.btn} onClick={playSongQueue3} disabled={!normalizedSongs.length}>
                        setNewQueue (max 3 songs)
                    </button>

                    <div style={styles.small}>
                        songs (signed): <b>{normalizedSongs.length}</b>
                    </div>
                </div>

                <div style={styles.card}>
                    <h3>Podcast testy</h3>
                    <button style={styles.btn} onClick={playFirstPodcast} disabled={!normalizedPodcasts.length}>
                        ▶ loadItem 1st podcast
                    </button>
                    <button style={styles.btn} onClick={playMixedQueue} disabled={!normalizedSongs.length && !normalizedPodcasts.length}>
                        mixed queue (2 songs + 1 podcast)
                    </button>

                    <div style={styles.small}>
                        podcasts (signed): <b>{normalizedPodcasts.length}</b>
                    </div>
                </div>

                <div style={styles.card}>
                    <h3>Album testy</h3>

                    <select
                        value={selectedAlbumID}
                        onChange={(e) => {
                            const v = e.target.value;
                            setSelectedAlbumID(v);
                            setAlbumSongs([]);
                            if (v) loadAlbumSongs(v);
                        }}
                        style={styles.select}
                    >
                        <option value="">— wybierz album —</option>
                        {albums.map((a) => (
                            <option key={a.albumID} value={a.albumID}>
                                {a.albumName || `Album ${a.albumID}`}
                            </option>
                        ))}
                    </select>

                    <button
                        style={styles.btn}
                        onClick={() => setAlbumQueue(0)}
                        disabled={!normalizedAlbumSongs.length}
                    >
                        setNewQueue(album) start=0
                    </button>

                    <button
                        style={styles.btn}
                        onClick={() => setAlbumQueue(2)}
                        disabled={normalizedAlbumSongs.length < 3}
                    >
                        setNewQueue(album) start=2
                    </button>

                    <div style={styles.small}>
                        albums: <b>{albums.length}</b>
                        <br />
                        albumSongs (signed): <b>{normalizedAlbumSongs.length}</b>
                    </div>
                </div>

                <div style={styles.card}>
                    <h3>Kontrola kolejki</h3>
                    <button style={styles.btn} onClick={playPrevious} disabled={!currentItem}>
                        ⏮ Prev
                    </button>
                    <button style={styles.btn} onClick={playNext} disabled={!currentItem}>
                        ⏭ Next
                    </button>

                    <div style={styles.small}>
                        current:{" "}
                        <b>
                            {currentItem
                                ? currentItem.songName || currentItem.podcastName || currentItem.title || "item"
                                : "—"}
                        </b>
                        <br />
                        playing: <b>{isPlaying ? "yes" : "no"}</b>
                        <br />
                        current: <b>{currentItem ? (currentItem.songName || currentItem.podcastName || "item") : "—"}</b>
                        <br />
                        playing: <b>{isPlaying ? "yes" : "no"}</b>
                        <br />
                        queue: <b>{queueIndex + 1}/{queue.length || 0}</b>
                        <br />
                        queue: <b>{queue?.length || 0}</b> / index: <b>{queueIndex}</b>
                        <br />
                        progress: <b>{Math.floor(progress)}</b>s / duration: <b>{Math.floor(duration)}</b>s
                    </div>
                </div>
            </div>
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        background: "#121212",
        color: "white",
        padding: "24px 28px 120px",
    },
    row: {
        display: "flex",
        gap: 12,
        alignItems: "center",
        marginBottom: 16,
        flexWrap: "wrap",
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 12,
    },
    card: {
        background: "#1e1e1e",
        border: "1px solid #2a2a2a",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
    },
    btn: {
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #333",
        background: "#222",
        color: "white",
        cursor: "pointer",
        textAlign: "left",
    },
    select: {
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #333",
        background: "#111",
        color: "white",
    },
    small: {
        marginTop: 6,
        fontSize: 13,
        opacity: 0.85,
        lineHeight: 1.4,
    },
};
