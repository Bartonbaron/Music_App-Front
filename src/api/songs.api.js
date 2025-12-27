import { apiFetch } from "./http";

export async function fetchSongs(token) {
    // u Ciebie to było: GET /api/songs
    return apiFetch("/songs", { token });
}

export async function fetchSong(token, songID) {
    return apiFetch(`/songs/${songID}`, { token });
}
