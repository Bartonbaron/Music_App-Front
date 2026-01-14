import { apiFetch } from "./http";

export function fetchFolders(token) {
    return apiFetch("/folders", { token });
}

export function fetchFolder(token, id) {
    return apiFetch(`/folders/${id}`, { token });
}

export function createFolder(token, folderName) {
    return apiFetch("/folders", {
        token,
        method: "POST",
        body: { folderName },
    });
}

export function renameFolder(token, id, folderName) {
    return apiFetch(`/folders/${id}`, {
        token,
        method: "PATCH",
        body: { folderName },
    });
}

export function deleteFolder(token, id) {
    return apiFetch(`/folders/${id}`, {
        token,
        method: "DELETE",
    });
}

export function fetchFolderPlaylists(token, id) {
    return apiFetch(`/folders/${id}/playlists`, { token });
}

export function addPlaylistToFolder(token, id, playlistID) {
    return apiFetch(`/folders/${id}/playlists`, {
        token,
        method: "POST",
        body: { playlistID },
    });
}

export function removePlaylistFromFolder(token, id, playlistID) {
    return apiFetch(`/folders/${id}/playlists/${playlistID}`, {
        token,
        method: "DELETE",
    });
}