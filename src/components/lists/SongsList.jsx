import { useMemo, useCallback } from "react";
import { usePlayer } from "../../contexts/PlayerContext";
import { mapSongToPlayerItem } from "../../utils/playerAdapter";

export default function SongsList({ songs }) {
    const { setNewQueue, loadItem } = usePlayer();

    const queueItems = useMemo(
        () => songs.map(mapSongToPlayerItem).filter(x => !!x.signedAudio),
        [songs]
    );

    const playFromSong = useCallback((songID) => {
        const idx = queueItems.findIndex(x => x.songID === songID);
        if (idx === -1) return; // brak signedAudio / brak w kolejce
        setNewQueue(queueItems, idx);
    }, [queueItems, setNewQueue]);

    const playNowSingle = (song) => {
        const item = mapSongToPlayerItem(song);
        if (!item?.signedAudio) return;
        loadItem(item, true);
    };

    return (
        <div>
            {songs.map((s) => (
                <div key={s.songID} style={{ display: "flex", gap: 12, padding: 8 }}>
                    <button onClick={() => playFromSong(s.songID)}>
                        ▶ Play od tego
                    </button>
                    <button onClick={() => playNowSingle(s)}>
                        Play tylko ten
                    </button>
                    <span>{s.songName}</span>
                </div>
            ))}
        </div>
    );
}

