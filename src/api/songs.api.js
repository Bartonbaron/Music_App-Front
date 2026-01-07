import { apiFetch } from "./http";

const BASE_URL = "http://localhost:3000/api";

export async function fetchSongs(token) {
    return apiFetch("/songs", { token });
}

export async function fetchSong(token, songID) {
    return apiFetch(`/songs/${songID}`, { token });
}

// Upload song (multipart/form-data)
export async function uploadSong(token, { file, cover, genreID }) {
    if (!token) throw new Error("Brak tokenu");
    if (!file) throw new Error("Brak pliku audio");
    if (!genreID) throw new Error("Brak genreID");

    const fd = new FormData();
    fd.append("file", file);
    if (cover) fd.append("cover", cover);
    fd.append("genreID", String(genreID));

    const res = await fetch(`${BASE_URL}/songs/upload`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: fd,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || "Nie udało się dodać utworu");
    return json;
}

// Delete song
export async function deleteSong(token, songID) {
    if (!token) throw new Error("Brak tokenu");
    if (!songID) throw new Error("Brak songID");

    return apiFetch(`/songs/${songID}`, {
        token,
        method: "DELETE",
    });
}