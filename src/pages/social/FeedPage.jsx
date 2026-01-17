import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, RefreshCw, Play } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext.jsx";
import { usePlayer } from "../../contexts/PlayerContext.jsx";
import { fetchFeed } from "../../api/social/feed.api.js";

import SongActionsModal from "../../components/actions/SongActionsModal.jsx";
import PodcastActionsModal from "../../components/actions/PodcastActionsModal.jsx";
import AddToPlaylistModal from "../../components/playlists/AddToPlaylistModal.jsx";

function formatDateTimePL(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function pickCover(item) {
    return item?.signedCover || item?.coverSigned || item?.coverURL || null;
}

function pickTitle(item) {
    return (
        item?.songName ||
        item?.title ||
        item?.podcastName ||
        (item?.songID ? `Song ${item.songID}` : item?.podcastID ? `Podcast ${item.podcastID}` : "Pozycja")
    );
}

function normalizeToPlayerItem(x) {
    if (!x) return null;

    if (x.type === "song") {
        const s = x.song || x.raw || {};
        return {
            type: "song",
            songID: x.songID ?? s.songID,
            songName: x.title ?? s.songName ?? "Utwór",
            creatorName: x.creatorName ?? s.creatorName ?? s?.creator?.user?.userName ?? null,
            signedAudio: x.signedAudio ?? s.signedAudio ?? null,
            signedCover: x.signedCover ?? s.signedCover ?? null,
            duration: s.duration ?? x.duration,
            moderationStatus: x.moderationStatus ?? s.moderationStatus,
            isHidden: !!x.isHidden || x.moderationStatus === "HIDDEN" || s.moderationStatus === "HIDDEN",
            raw: s,
            createdAt: x.createdAt,
        };
    }

    if (x.type === "podcast") {
        const p = x.podcast || x.raw || {};
        return {
            type: "podcast",
            podcastID: x.podcastID ?? p.podcastID,
            title: x.title ?? p.title ?? p.podcastName ?? "Podcast",
            creatorName: x.creatorName ?? p.creatorName ?? p?.creator?.user?.userName ?? null,
            signedAudio: x.signedAudio ?? p.signedAudio ?? null,
            signedCover: x.signedCover ?? p.signedCover ?? null,
            duration: p.duration ?? x.duration,
            moderationStatus: x.moderationStatus ?? p.moderationStatus,
            isHidden: !!x.isHidden || x.moderationStatus === "HIDDEN" || p.moderationStatus === "HIDDEN",
            raw: p,
            createdAt: x.createdAt,
        };
    }

    return null;
}

export default function FeedPage() {
    const { token } = useAuth();
    const navigate = useNavigate();

    const {
        setNewQueue,
        enqueueServerEndSong,
        enqueueServerNextSong,
        enqueueServerEndPodcast,
        enqueueServerNextPodcast,
    } = usePlayer();

    const [days, setDays] = useState(30);
    const [limit] = useState(60);

    const [data, setData] = useState({ count: 0, items: [] });
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const [toast, setToast] = useState(null);
    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1400);
    }, []);

    // modal "więcej"
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuBusy, setMenuBusy] = useState(false);
    const [activeItem, setActiveItem] = useState(null); // { type, songID/podcastID, title, hidden }

    // modal "dodaj do playlisty"
    const [addToPlaylistOpen, setAddToPlaylistOpen] = useState(false);
    const [addToPlaylistSong, setAddToPlaylistSong] = useState(null); // { songID, title }

    const load = useCallback(async () => {
        if (!token) {
            setMsg("Zaloguj się, aby zobaczyć feed obserwowanych twórców.");
            setData({ count: 0, items: [] });
            return;
        }

        setLoading(true);
        setMsg("");
        try {
            const res = await fetchFeed(token, { limit, days });
            setData(res && typeof res === "object" ? res : { count: 0, items: [] });
            if ((res?.items || []).length === 0) {
                setMsg("Brak nowości od obserwowanych twórców.");
            }
        } catch (e) {
            setMsg(e?.message || "Nie udało się pobrać feedu.");
            setData({ count: 0, items: [] });
        } finally {
            setLoading(false);
        }
    }, [token, limit, days]);

    useEffect(() => {
        load();
    }, [load]);

    const items = useMemo(() => {
        const raw = Array.isArray(data?.items) ? data.items : [];
        return raw.map(normalizeToPlayerItem).filter(Boolean);
    }, [data?.items]);

    const queueItems = useMemo(() => {
        // feed jako baseQueue: tylko odtwarzalne i nie hidden
        return items.filter((x) => !!x.signedAudio && !x.isHidden);
    }, [items]);

    const queueIndexByKey = useMemo(() => {
        const m = new Map();
        queueItems.forEach((q, i) => {
            const k = q.type === "song" ? `s:${q.songID}` : `p:${q.podcastID}`;
            m.set(k, i);
        });
        return m;
    }, [queueItems]);

    const goToDetails = useCallback(
        (item) => {
            if (!item) return;

            if (item.type === "song" && item.songID) {
                navigate(`/songs/${item.songID}`);
                return;
            }
            if (item.type === "podcast" && item.podcastID) {
                navigate(`/podcasts/${item.podcastID}`);
                return;
            }
        },
        [navigate]
    );

    const openMenu = useCallback((item) => {
        if (!item) return;
        if (item.isHidden) return;

        setActiveItem({
            type: item.type,
            songID: item.songID,
            podcastID: item.podcastID,
            title: pickTitle(item),
            hidden: !!item.isHidden,
        });
        setMenuOpen(true);
    }, []);

    const handlePlayAll = useCallback(() => {
        if (!queueItems.length) return;
        setNewQueue(queueItems, 0);
    }, [queueItems, setNewQueue]);

    const handlePlayFrom = useCallback(
        (item) => {
            if (!item || item.isHidden || !item.signedAudio) return;

            const key = item.type === "song" ? `s:${item.songID}` : `p:${item.podcastID}`;
            const idx = queueIndexByKey.get(key);
            if (idx == null) return;

            setNewQueue(queueItems, idx);
        },
        [queueItems, queueIndexByKey, setNewQueue]
    );

    // akcje w modalu "Więcej"
    const handleAddToQueue = useCallback(async () => {
        if (!activeItem || activeItem.hidden) return;

        setMenuBusy(true);
        try {
            if (activeItem.type === "song") {
                await enqueueServerEndSong?.(activeItem.songID);
            } else {
                await enqueueServerEndPodcast?.(activeItem.podcastID);
            }
            showToast("Dodano do kolejki", "success");
            setMenuOpen(false);
        } catch (e) {
            showToast(e?.message || "Błąd dodawania do kolejki", "error");
        } finally {
            setMenuBusy(false);
        }
    }, [activeItem, enqueueServerEndSong, enqueueServerEndPodcast, showToast]);

    const handlePlayNext = useCallback(async () => {
        if (!activeItem || activeItem.hidden) return;

        setMenuBusy(true);
        try {
            if (activeItem.type === "song") {
                await enqueueServerNextSong?.(activeItem.songID);
            } else {
                await enqueueServerNextPodcast?.(activeItem.podcastID);
            }
            showToast("Ustawiono jako następny", "success");
            setMenuOpen(false);
        } catch (e) {
            showToast(e?.message || "Błąd ustawiania następnego", "error");
        } finally {
            setMenuBusy(false);
        }
    }, [activeItem, enqueueServerNextSong, enqueueServerNextPodcast, showToast]);

    const openAddToPlaylist = useCallback(() => {
        if (!activeItem || activeItem.hidden) return;
        if (activeItem.type !== "song" || !activeItem.songID) return;

        setAddToPlaylistSong({ songID: activeItem.songID, title: activeItem.title });
        setMenuOpen(false);
        setAddToPlaylistOpen(true);
    }, [activeItem]);

    if (!token) {
        return (
            <div style={styles.page}>
                <div style={styles.hint}>Zaloguj się, aby zobaczyć feed obserwowanych twórców.</div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            {/* TOAST */}
            {toast ? (
                <div
                    style={{
                        ...styles.toast,
                        borderColor: toast.type === "error" ? "#7a2a2a" : "#2a7a3a",
                        background: toast.type === "error" ? "#2a1515" : "#142015",
                    }}
                >
                    {toast.text}
                </div>
            ) : null}

            {/* TOP BAR */}
            <div style={styles.top}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={styles.iconBubble}>
                        <Radio size={18} style={{ display: "block" }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <h1 style={styles.h1}>Nowości od obserwowanych twórców</h1>
                        <div style={styles.sub}></div>
                    </div>
                </div>

                <div style={styles.controls}>
                    <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={styles.select} title="Zakres czasu">
                        <option value={7}>Ostatnie 7 dni</option>
                        <option value={14}>Ostatnie 14 dni</option>
                        <option value={30}>Ostatnie 30 dni</option>
                        <option value={90}>Ostatnie 90 dni</option>
                    </select>

                    <button
                        type="button"
                        onClick={load}
                        disabled={loading}
                        style={{
                            ...styles.btn,
                            opacity: loading ? 0.6 : 1,
                            cursor: loading ? "not-allowed" : "pointer",
                        }}
                        title="Odśwież"
                    >
                        <RefreshCw size={16} style={{ display: "block" }} />
                    </button>

                    <button
                        type="button"
                        onClick={handlePlayAll}
                        disabled={!queueItems.length}
                        style={{
                            ...styles.primaryBtn,
                            opacity: queueItems.length ? 1 : 0.6,
                            cursor: queueItems.length ? "pointer" : "not-allowed",
                        }}
                        title="Odtwórz wszystkie odtwarzalne"
                    >
                        <Play size={16} style={{ display: "block" }} /> Odtwórz
                    </button>
                </div>
            </div>

            {loading ? <div style={{ opacity: 0.75 }}>Ładowanie…</div> : null}
            {msg ? <div style={styles.hint}>{msg}</div> : null}

            {/* LIST */}
            <div style={styles.list}>
                {items.map((it, idx) => {
                    const hidden = !!it.isHidden || it.moderationStatus === "HIDDEN";
                    const playable = !!it.signedAudio && !hidden;

                    const cover = pickCover(it);
                    const title = pickTitle(it);
                    const creatorName = it.creatorName || "—";
                    const dateLabel = formatDateTimePL(it.createdAt);

                    return (
                        <div
                            key={`${it.type}:${it.type === "song" ? it.songID : it.podcastID}:${idx}`}
                            style={{
                                ...styles.row,
                                opacity: playable ? 1 : 0.55,
                                filter: playable ? "none" : "grayscale(0.25)",
                            }}
                            title={!playable ? (hidden ? "Utwór/odcinek ukryty przez administrację" : "Niedostępne") : undefined}
                        >
                            {/* play */}
                            <button
                                type="button"
                                onClick={() => handlePlayFrom(it)}
                                disabled={!playable}
                                style={{
                                    ...styles.rowPlayBtn,
                                    opacity: playable ? 1 : 0.45,
                                    cursor: playable ? "pointer" : "not-allowed",
                                }}
                                title={hidden ? "Utwór/odcinek ukryty przez administrację" : playable ? "Odtwórz od tego" : "Niedostępne"}
                            >
                                ▶
                            </button>

                            {/* cover */}
                            <div style={styles.miniCoverWrap}>
                                {cover ? <img src={cover} alt="" style={styles.miniCoverImg} /> : <div style={styles.miniCoverPh} />}
                            </div>

                            {/* meta */}
                            <div style={{ minWidth: 0, overflow: "hidden" }}>
                                <div style={styles.titleLine}>
                                    {/* Klik w tytuł -> szczegóły */}
                                    <button
                                        type="button"
                                        onClick={() => goToDetails(it)}
                                        disabled={hidden}
                                        style={{
                                            ...styles.titleBtn,
                                            cursor: hidden ? "not-allowed" : "pointer",
                                            opacity: hidden ? 0.6 : 1,
                                        }}
                                        title={hidden ? "Niedostępne (ukryte przez administrację)" : "Przejdź do szczegółów"}
                                    >
                                    <span style={styles.itemTitle} title={title}>
                                    {title}
                                    </span>
                                    </button>

                                    <span style={styles.badge} title={it.type}>
                                        {it.type === "song" ? "UTWÓR" : "PODCAST"}
                                    </span>

                                    {hidden ? <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.75 }}>(niedostępny)</span> : null}
                                </div>

                                <div style={styles.subLine} title={creatorName}>
                                    {creatorName}
                                    <span style={{ opacity: 0.65 }}> • </span>
                                    <span style={{ opacity: 0.85 }}>{dateLabel}</span>
                                </div>
                            </div>

                            {/* tylko "więcej" — zablokowane dla ukrytych */}
                            <div style={styles.quickActions}>
                                <button
                                    type="button"
                                    onClick={() => openMenu(it)}
                                    disabled={hidden}
                                    style={{
                                        ...styles.moreBtn,
                                        opacity: hidden ? 0.35 : 1,
                                        cursor: hidden ? "not-allowed" : "pointer",
                                    }}
                                    title={hidden ? "Niedostępne (ukryte przez administrację)" : "Więcej"}
                                >
                                    ⋯
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* MODAL: WIĘCEJ */}
            {activeItem?.type === "song" ? (
                <SongActionsModal
                    open={menuOpen}
                    onClose={() => setMenuOpen(false)}
                    songTitle={activeItem?.title}
                    hidden={!!activeItem?.hidden}
                    canRemoveFromCurrent={false}
                    busy={menuBusy}
                    onAddToPlaylist={activeItem?.hidden ? null : openAddToPlaylist}
                    onRemoveFromCurrent={null}
                    onAddToQueue={activeItem?.hidden ? null : handleAddToQueue}
                    onPlayNext={activeItem?.hidden ? null : handlePlayNext}
                />
            ) : (
                <PodcastActionsModal
                    open={menuOpen}
                    onClose={() => setMenuOpen(false)}
                    podcastTitle={activeItem?.title}
                    busy={menuBusy}
                    onAddToQueue={activeItem?.hidden ? null : handleAddToQueue}
                    onPlayNext={activeItem?.hidden ? null : handlePlayNext}
                />
            )}

            {/* MODAL: DODAJ DO PLAYLISTY */}
            <AddToPlaylistModal
                open={addToPlaylistOpen}
                onClose={() => {
                    setAddToPlaylistOpen(false);
                    setAddToPlaylistSong(null);
                }}
                songID={addToPlaylistSong?.songID}
                songTitle={addToPlaylistSong?.title}
                onToast={showToast}
            />

            <div style={{ height: 120 }} />
        </div>
    );
}

const styles = {
    page: { padding: 20, color: "white", paddingBottom: 120, background: "#121212", minHeight: "100vh" },

    toast: {
        position: "fixed",
        right: 18,
        bottom: 110,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        color: "white",
        zIndex: 999,
        fontSize: 13,
    },

    top: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 14 },

    iconBubble: {
        width: 42,
        height: 42,
        borderRadius: 14,
        border: "1px solid #2a2a2a",
        background: "#1a1a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    h1: { margin: "6px 0 4px", fontSize: 22, lineHeight: 1.1 },
    sub: { opacity: 0.8, fontSize: 13 },

    controls: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

    select: {
        height: 38,
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "#1a1a1a",
        color: "white",
        padding: "0 10px",
        fontWeight: 800,
    },

    btn: {
        width: 38,
        height: 38,
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "#1a1a1a",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    primaryBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        border: "none",
        background: "#1db954",
        color: "#000",
        fontWeight: 900,
        height: 38,
    },

    hint: {
        background: "#1b1b1b",
        border: "1px solid #2a2a2a",
        padding: 12,
        borderRadius: 12,
        opacity: 0.9,
        fontSize: 13,
        marginBottom: 12,
    },

    list: { display: "flex", flexDirection: "column", gap: 10, marginTop: 10 },

    row: {
        display: "grid",
        gridTemplateColumns: "44px 44px 1fr 60px",
        gap: 12,
        alignItems: "center",
        padding: "12px 10px",
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "#141414",
    },

    rowPlayBtn: {
        width: 38,
        height: 34,
        borderRadius: 10,
        border: "1px solid #333",
        background: "transparent",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        lineHeight: 0,
    },

    miniCoverWrap: {
        width: 34,
        height: 34,
        borderRadius: 10,
        overflow: "hidden",
        background: "#2a2a2a",
        border: "1px solid #2a2a2a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        justifySelf: "center",
    },
    miniCoverImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
    miniCoverPh: { width: "100%", height: "100%", background: "#2a2a2a" },

    titleLine: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },

    titleBtn: {
        background: "transparent",
        border: "none",
        padding: 0,
        margin: 0,
        color: "white",
        cursor: "pointer",
        minWidth: 0,
        display: "inline-flex",
        alignItems: "center",
        maxWidth: "100%",
    },

    itemTitle: { fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    badge: {
        fontSize: 11,
        fontWeight: 900,
        opacity: 0.85,
        border: "1px solid #2a2a2a",
        background: "#101010",
        padding: "4px 8px",
        borderRadius: 999,
        letterSpacing: 0.5,
        whiteSpace: "nowrap",
    },

    subLine: { fontSize: 12, opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    quickActions: { display: "flex", justifyContent: "flex-end", alignItems: "center" },

    moreBtn: {
        width: 38,
        height: 34,
        borderRadius: 10,
        border: "1px solid #333",
        background: "transparent",
        color: "white",
        fontWeight: 900,
        fontSize: 18,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        lineHeight: 0,
    },
};