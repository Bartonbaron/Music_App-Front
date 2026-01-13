export async function addSongToQueue(token, songID, mode = "END") {
    const res = await fetch("http://localhost:3000/api/queue", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ songID: Number(songID), mode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Nie udało się dodać do kolejki");
    return data;
}

export async function addPodcastToQueue(token, podcastID, mode = "END") {
    const res = await fetch("http://localhost:3000/api/queue", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ podcastID: Number(podcastID), mode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Nie udało się dodać do kolejki");
    return data;
}


export async function getQueue(token) {
    const res = await fetch("http://localhost:3000/api/queue", {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Nie udało się pobrać kolejki");
    return data; // { count, items }
}

export async function removeQueueItem(token, queueID) {
    const res = await fetch(`http://localhost:3000/api/queue/${queueID}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Nie udało się usunąć z kolejki");
    return data;
}

export async function clearQueue(token) {
    const res = await fetch("http://localhost:3000/api/queue", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Nie udało się wyczyścić kolejki");
    return data;
}