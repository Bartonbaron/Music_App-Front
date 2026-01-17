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