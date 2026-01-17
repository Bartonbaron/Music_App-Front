import { apiFetch } from "../http.js";

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
        body: { bio },
    });
}

export async function fetchMyCreatorProfile(token) {
    if (!token) throw new Error("Brak tokenu");
    return apiFetch("/creators/me", { token });
}

export async function fetchMyFollowersStats(token) {
    return apiFetch("/creators/me/followers/stats", { token });
}


