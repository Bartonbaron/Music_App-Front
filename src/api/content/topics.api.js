import { apiFetch } from "../http.js";

export async function fetchTopics(token) {
    if (!token) throw new Error("Brak tokenu");
    return apiFetch("/topics", { token });
}