import { apiFetch } from "./http";

export async function fetchTopics(token) {
    if (!token) throw new Error("Brak tokenu");
    return apiFetch("/topics", { token });
}