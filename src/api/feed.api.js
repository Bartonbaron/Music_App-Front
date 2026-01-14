export async function fetchFeed(token, { limit = 60, days = 30 } = {}) {
    const qs = new URLSearchParams({
        limit: String(limit),
        days: String(days),
    });

    const res = await fetch(`http://localhost:3000/api/feed?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Nie udało się pobrać feedu");
    return data;
}
