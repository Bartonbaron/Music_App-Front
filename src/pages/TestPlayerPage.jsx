import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { usePlayer } from "../contexts/PlayerContext";

export default function TestPlayerPage() {
    const { token } = useAuth();
    const { loadItem, setNewQueue, playNext, playPrevious, currentItem, isPlaying } = usePlayer();

    const [songs, setSongs] = useState([]);
    const [podcasts, setPodcasts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const fetchSongs = async () => {
        const res = await fetch("http://localhost:3000/api/songs", {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to fetch songs");
        return Array.isArray(data) ? data : data.songs || [];
    };

    const fetchPodcasts = async () => {
        const res = await fetch("http://localhost:3000/api/podcasts", {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to fetch podcasts");
        return Array.isArray(data) ? data : data.podcasts || [];
    };

    const refresh = async () => {
        setLoading(true);
        setMsg("");
        try {
            const [s, p] = await Promise.all([fetchSongs(), fetchPodcasts()]);
            setSongs(s);
            setPodcasts(p);
            setMsg(`OK: songs=${s.length}, podcasts=${p.length}`);
        } catch (e) {
            setMsg(e.message || "Error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!token) return;
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const normalizeSong = (song) => ({
        ...song,
        type: "song",
        signedAudio: song.signedAudio || song.signedUrl || song.audioSignedUrl,
        signedCover: song.signedCover || song.coverSignedUrl,
    });

    const normalizePodcast = (podcast) => ({
        ...podcast,
        type: "podcast",
        signedAudio: podcast.signedAudio || podcast.signedUrl || podcast.audioSignedUrl,
        signedCover: podcast.signedCover || podcast.coverSignedUrl,
    });

    const playFirstSong = async () => {
        if (!songs.length) return setMsg("Brak utworów do testu");
        const item = normalizeSong(songs[0]);
        if (!item.signedAudio) return setMsg("Pierwszy utwór nie ma signedAudio");
        await loadItem(item, true);
        setMsg("Rozpoczęto strumieniowanie pierwszego utworu");
    };

    const playSongQueue3 = () => {
        if (songs.length < 1) return setMsg("Brak utworów do kolejki");
        const items = songs.slice(0, 3).map(normalizeSong).filter((x) => x.signedAudio);
        if (!items.length) return setMsg("Brak signedAudio w pierwszych 3 utworach");
        setNewQueue(items, 0);
        setMsg(`Ustawiono kolejkę: ${items.length} utworów`);
    };

    const playFirstPodcast = async () => {
        if (!podcasts.length) return setMsg("Brak podcastów do testu");
        const item = normalizePodcast(podcasts[0]);
        if (!item.signedAudio) return setMsg("Pierwszy podcast nie ma signedAudio");
        await loadItem(item, true);
        setMsg("Rozpoczęto strumieniowanie pierwszego podcastu");
    };

    return (
        <div style={styles.page}>
            <h2 style={{ marginTop: 0 }}>Test Playera</h2>

            <div style={styles.row}>
                <button style={styles.btn} onClick={refresh} disabled={loading || !token}>
                    {loading ? "Ładowanie..." : "Odśwież listy (songs/podcasts)"}
                </button>

                <div style={{ opacity: 0.85 }}>
                    {msg && <span>{msg}</span>}
                </div>
            </div>

            <div style={styles.grid}>
                <div style={styles.card}>
                    <h3>Song testy</h3>
                    <button style={styles.btn} onClick={playFirstSong} disabled={!songs.length}>
                        ▶ Play 1st song
                    </button>
                    <button style={styles.btn} onClick={playSongQueue3} disabled={!songs.length}>
                        📜 Set queue (max 3 songs)
                    </button>

                    <div style={styles.small}>
                        songs: <b>{songs.length}</b>
                    </div>
                </div>

                <div style={styles.card}>
                    <h3>Podcast testy</h3>
                    <button style={styles.btn} onClick={playFirstPodcast} disabled={!podcasts.length}>
                        ▶ Play 1st podcast
                    </button>

                    <div style={styles.small}>
                        podcasts: <b>{podcasts.length}</b>
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
                        current: <b>{currentItem ? (currentItem.songName || currentItem.podcastName || "item") : "—"}</b>
                        <br />
                        playing: <b>{isPlaying ? "yes" : "no"}</b>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: 18, opacity: 0.8 }}></div>
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
    small: {
        marginTop: 6,
        fontSize: 13,
        opacity: 0.85,
        lineHeight: 1.4,
    },
};
