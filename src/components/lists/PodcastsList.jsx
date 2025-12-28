import { useMemo } from "react";
import { usePlayer } from "../../contexts/PlayerContext";
import { mapPodcastToPlayerItem } from "../../utils/playerAdapter";

export default function PodcastsList({ podcasts }) {
    const { setNewQueue } = usePlayer();

    const queueItems = useMemo(
        () => podcasts.map(mapPodcastToPlayerItem).filter(x => !!x.signedAudio),
        [podcasts]
    );

    return (
        <div>
            {podcasts.map((p, idx) => (
                <div key={p.podcastID} style={{ display: "flex", gap: 12, padding: 8 }}>
                    <button onClick={() => setNewQueue(queueItems, idx)}>▶</button>
                    <span>{p.podcastName}</span>
                </div>
            ))}
        </div>
    );
}
