import { apiFetch } from "../http.js";

export function createFolder(token, folderName) {
    return apiFetch("/folders", {
        token,
        method: "POST",
        body: { folderName },
    });
}

export function deleteFolder(token, id) {
    return apiFetch(`/folders/${id}`, {
        token,
        method: "DELETE",
    });
}