import { apiFetch } from "./http";

const BASE_URL = "http://localhost:3000/api";

export async function fetchMyProfile(token) {
    return apiFetch("/users/me", { token });
}

export async function fetchPublicUser({ token, userID }) {
    const id = userID ?? null;
    if (!id) throw new Error("Brak userID");
    return apiFetch(`/users/${id}/public`, { token });
}

export async function fetchPublicUserPlaylists(token, userID) {
    const id = userID ?? null;
    if (!id) throw new Error("Brak userID");
    return apiFetch(`/users/${userID}/public-playlists`, {token});
}

export async function updateMyProfile(token, { userName, email } = {}) {
    return apiFetch("/users/me", {
        token,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userName: userName?.trim() || undefined,
            email: email?.trim() || undefined,
        }),
    });
}

export async function changeMyPassword(token, { oldPassword, newPassword } = {}) {
    return apiFetch("/users/password", {
        token,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
    });
}

export async function updatePlaybackPreferences(token, { volume, playbackMode, autoplay } = {}) {
    return apiFetch("/users/preferences", {
        token,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume, playbackMode, autoplay }),
    });
}

export async function uploadMyAvatar(token, file) {
    if (!file) throw new Error("Brak pliku");

    const fd = new FormData();
    fd.append("avatar", file);

    return apiFetch("/avatars", {
        token,
        method: "POST",
        body: fd,
    });
}

export async function deleteMyAvatar(token) {
    return apiFetch("/avatars", {
        token,
        method: "DELETE",
    });
}
