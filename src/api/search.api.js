import { apiFetch } from "./http";

export async function searchAll({ token, q, signal }) {
    const qs = new URLSearchParams();
    if (q != null) qs.set("q", String(q));

    return apiFetch(`/search?${qs.toString()}`, { token, signal });
}
