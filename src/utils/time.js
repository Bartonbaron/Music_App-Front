export function formatTrackDuration(sec) {
    const s = Number(sec);
    if (!Number.isFinite(s) || s <= 0) return "—";
    const total = Math.floor(s);
    const m = Math.floor(total / 60);
    const r = total % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
}

export function formatTotalDuration(sec) {
    const s = Number(sec);
    if (!Number.isFinite(s) || s <= 0) return "—";

    const total = Math.floor(s);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const r = total % 60;

    if (h > 0) return `${h} godz ${m} min`;
    if (m === 0) return `${r} s`;
    return `${m} min ${r} s`;
}
