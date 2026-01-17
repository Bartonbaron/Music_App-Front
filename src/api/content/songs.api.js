import { apiFetch } from "../http.js";

export async function fetchSongs(token) {
    return apiFetch("/songs", { token });
}