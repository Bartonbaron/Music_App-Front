export function mapSongToPlayerItem(song) {
    return {
        type: "song",
        songID: song.songID,
        songName: song.songName ?? song.title ?? "Utwór",
        title: song.songName ?? song.title ?? "Utwór",
        creatorName: song.artist ?? song.creatorName ?? song?.creator?.user?.userName ?? null,
        signedAudio: song.signedAudio ?? song.fileURL ?? null,
        signedCover: song.signedCover ?? song.coverURL ?? null,
        raw: song,
    };
}

export function mapPodcastToPlayerItem(podcast) {
    return {
        type: "podcast",
        podcastID: podcast.podcastID,
        podcastName: podcast.podcastName,
        title: podcast.podcastName ?? podcast.title ?? "Podcast",
        creatorName: podcast?.creator?.user?.userName ?? podcast.creatorName ?? null,
        signedAudio: podcast.signedAudio ?? podcast.fileURL ?? null,
        signedCover: podcast.signedCover ?? podcast.coverURL ?? null,
        raw: podcast,
    };
}