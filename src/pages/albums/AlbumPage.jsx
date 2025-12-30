import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { usePlayer } from "../../contexts/PlayerContext";
import { mapSongToPlayerItem } from "../../utils/playerAdapter";

function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "—";

    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);

    return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTotalDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "—";

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);

    if (h > 0) {
        return `${h} godz. ${m} min`;
    }

    return `${m} min`;
}

export default function AlbumPage() {
    const { id } = useParams();
    const { setNewQueue } = usePlayer();

    const [album, setAlbum] = useState(null);
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");

    const totalDuration = useMemo(() => {
        return songs.reduce((sum, s) => {
            return sum + (Number(s.duration) || 0);
        }, 0);
    }, [songs]);

    useEffect(() => {
        const token = localStorage.getItem("token");

        const fetchAlbum = async () => {
            const res = await fetch(`http://localhost:3000/api/albums/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to fetch album");
            return data;
        };

        const fetchSongs = async () => {
            const res = await fetch(`http://localhost:3000/api/albums/${id}/songs`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to fetch album songs");
            return data.songs ?? [];
        };

        (async () => {
            setLoading(true);
            setMsg("");
            try {
                const [a, s] = await Promise.all([fetchAlbum(), fetchSongs()]);
                setAlbum(a);
                setSongs(s);
            } catch (e) {
                setMsg(e.message || "Error");
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const queueItems = useMemo(() => {
        const albumCover = album?.signedCover || null;

        const albumArtist = album?.creator?.user?.userName || null;

        return songs
            .map((s) => {
                const item = mapSongToPlayerItem(s);

                return {
                    ...item,
                    // cover: album > track
                    signedCover: albumCover || item.signedCover,
                    // creator: album > track
                    creatorName: albumArtist || item.creatorName || null,
                };
            })
            .filter((x) => !!x.signedAudio);
    }, [songs, album]);

    const playAlbum = () => setNewQueue(queueItems, 0);

    if (loading) return <div style={{ padding: 20, color: "white" }}>Ładowanie…</div>;
    if (msg) return <div style={{ padding: 20, color: "white" }}>{msg}</div>;

    const albumCover = album?.signedCover || null;
    const albumArtist = album?.creator?.user?.userName || null;

    return (
        <div style={{ padding: 20, color: "white", paddingBottom: 120 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div
                    style={{
                        width: 140,
                        height: 140,
                        borderRadius: 12,
                        overflow: "hidden",
                        background: "#2a2a2a",
                        flex: "0 0 auto",
                    }}
                >
                    {albumCover ? (
                        <img
                            src={albumCover}
                            alt="cover"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                    ) : null}
                </div>

                <div style={{ minWidth: 0 }}>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>ALBUM</div>
                    <h2 style={{ margin: "6px 0 8px" }}>{album?.albumName || "Album"}</h2>

                    <div style={{ opacity: 0.6, fontSize: 12 }}>
                        {songs.length} utworów • {formatTotalDuration(totalDuration)}
                    </div>

                    <div style={{ opacity: 0.8, fontSize: 13 }}>
                        {albumArtist || ""}
                    </div>

                    <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button onClick={playAlbum} disabled={!queueItems.length}>
                            ▶ Odtwórz album
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: 18 }}>
                {songs.map((s, idx) => (
                    <div
                        key={s.songID}
                        style={{
                            display: "flex",
                            gap: 12,
                            alignItems: "center",
                            padding: "10px 8px",
                            borderBottom: "1px solid #2a2a2a",
                        }}
                    >
                        <button
                            onClick={() => setNewQueue(queueItems, idx)}
                            disabled={!queueItems.length}
                            title="Odtwórz od tego"
                        >
                            ▶
                        </button>

                        <div style={{ width: 32, opacity: 0.7, textAlign: "right" }}>
                            {s.trackNumber ?? idx + 1}.
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                                style={{
                                    fontWeight: 600,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                            >
                                {s.songName}
                            </div>

                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                                {formatDuration(s.duration)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
