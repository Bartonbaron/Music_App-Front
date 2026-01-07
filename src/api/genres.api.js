import { apiFetch } from "./http";

export async function fetchGenres(token) {
    if (!token) throw new Error("Brak tokenu");
    return apiFetch("/genres", { token });
}