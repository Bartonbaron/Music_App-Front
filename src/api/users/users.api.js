import { apiFetch } from "../http.js";

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
    const nameTrim = userName === undefined ? undefined : String(userName).trim();
    const emailTrim = email === undefined ? undefined : String(email).trim();

    return apiFetch("/users/me", {
        token,
        method: "PATCH",
        body: {
            userName: nameTrim || undefined,
            email: emailTrim === "" ? null : emailTrim || undefined,
        },
    });
}

export async function changeMyPassword(token, { oldPassword, newPassword } = {}) {
    return apiFetch("/users/password", {
        token,
        method: "PATCH",
        body: { oldPassword, newPassword },
    });
}

export async function updatePlaybackPreferences(token, { volume, playbackMode, autoplay } = {}) {
    return apiFetch("/users/preferences", {
        token,
        method: "PATCH",
        body: { volume, playbackMode, autoplay },
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

export async function deactivateAccount(token) {
    const res = await fetch("http://localhost:3000/api/users/me/deactivate", {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || "Nie udało się zdezaktywować konta");
    }
    return data;
}