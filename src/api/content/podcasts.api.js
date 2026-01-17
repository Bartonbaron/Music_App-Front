import { apiFetch } from "../http.js";

export async function fetchPodcasts(token) {
    return apiFetch("/podcasts", { token });
}

export async function fetchPodcast(token, id) {
    return apiFetch(`/podcasts/${id}`, { token });
}
