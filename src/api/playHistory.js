const BASE_URL = "http://localhost:3000/api";

export async function fetchPlayHistory(token) {
    const res = await fetch(`${BASE_URL}/playhistory`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to fetch play history");
    return data; // { count, items }
}

export async function addToPlayHistory(token, payload) {
    // payload: { songID } albo { podcastID }
    const res = await fetch(`${BASE_URL}/playhistory`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to add to history");
    return data;
}

export async function clearPlayHistory(token) {
    const res = await fetch(`${BASE_URL}/playhistory`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to clear history");
    return data;
}
