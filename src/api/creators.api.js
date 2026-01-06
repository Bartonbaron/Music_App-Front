import { apiFetch } from "./http";

export async function fetchCreatorProfile(token, creatorID) {
    if (!token) throw new Error("Brak tokenu");
    if (!creatorID) throw new Error("Brak creatorID");

    return apiFetch(`/creators/${creatorID}`, {
        token,
    });
}

export async function toggleFollowCreator(token, creatorID) {
    if (!token) throw new Error("Brak tokenu");
    if (!creatorID) throw new Error("Brak creatorID");

    return apiFetch(`/creators/${creatorID}/toggle-follow`, {
        token,
        method: "POST",
    });
}

export async function updateMyCreatorBio(token, bio) {
    if (!token) throw new Error("Brak tokenu");

    return apiFetch("/creators/me", {
        token,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio }),
    });
}

export async function fetchMyCreatorProfile(token) {
    if (!token) throw new Error("Brak tokenu");
    return apiFetch("/creators/me", { token });
}

