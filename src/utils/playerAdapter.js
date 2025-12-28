export function mapSongToPlayerItem(song) {
    return {
        type: "song",
        id: song.songID,
        title: song.songName ?? song.title ?? "Utwór",
        signedAudio: song.signedAudio ?? song.fileURL ?? null,
        signedCover: song.signedCover ?? song.coverURL ?? null,
        raw: song,
    };
}

export function mapPodcastToPlayerItem(podcast) {
    return {
        type: "podcast",
        id: podcast.podcastID,
        title: podcast.podcastName ?? podcast.title ?? "Podcast",
        signedAudio: podcast.signedAudio ?? podcast.fileURL ?? null,
        signedCover: podcast.signedCover ?? podcast.coverURL ?? null,
        raw: podcast,
    };
}
