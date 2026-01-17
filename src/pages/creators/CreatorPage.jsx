import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    User as UserIcon,
    Users,
    Pencil,
    Save,
    X,
    Play,
    ListMusic,
} from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";

import { fetchMyCreatorProfile, updateMyCreatorBio } from "../../api/creators/creators.api.js";
import { mapPodcastToPlayerItem } from "../../utils/playerAdapter";

import CreatorSongsManager from "../../components/creator/CreatorSongsManager";
import CreatorPodcastsManager from "../../components/creator/CreatorPodcastsManager.jsx";
import CreatorAlbumsManager from "../../components/creator/CreatorAlbumsManager.jsx";

function pickAvatar(data) {
    return (
        data?.signedProfilePicURL ||
        data?.signedAvatar ||
        data?.avatarURL ||
        data?.user?.signedProfilePicURL ||
        data?.user?.profilePicURL ||
        null
    );
}

function pickCreatorName(data) {
    return data?.userName || data?.user?.userName || "Twórca";
}

function pickPodcastCover(p) {
    return p?.signedCover || p?.coverSigned || p?.coverURL || null;
}

function pickPodcastTitle(p) {
    return p?.podcastName || p?.title || "Podcast";
}

function pickPlaylistCover(p) {
    return p?.signedCover || p?.coverSigned || p?.coverURL || null;
}
function pickPlaylistName(p) {
    return p?.playlistName || p?.name || "Playlista";
}
function pickItemsCount(p) {
    const n = p?.songsCount ?? p?.itemsCount ?? p?.tracksCount ?? p?.songs?.length ?? null;
    const nn = Number(n);
    return Number.isFinite(nn) ? nn : null;
}

export default function CreatorPage() {
    const navigate = useNavigate();
    const { token, user } = useAuth();
    const { setNewQueue, currentItem, isPlaying } = usePlayer();

    // guard: tylko Creator
    const roleName = user?.role?.roleName || user?.roleName || user?.role || "";
    const isCreatorRole = roleName === "Creator";

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const [toast, setToast] = useState(null);
    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1400);
    }, []);

    // modal edycji bio
    const [editOpen, setEditOpen] = useState(false);
    const [savingBio, setSavingBio] = useState(false);
    const [editBio, setEditBio] = useState("");

    const fetchMeCreator = useCallback(async () => {
        if (!isCreatorRole) return;

        if (!token) {
            setMsg("Zaloguj się, aby zobaczyć panel twórcy.");
            setData(null);
            return;
        }

        setLoading(true);
        setMsg("");
        try {
            const res = await fetchMyCreatorProfile(token);
            setData(res);
        } catch (e) {
            setMsg(e?.message || "Nie udało się pobrać profilu twórcy.");
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [token, isCreatorRole]);

    useEffect(() => {
        fetchMeCreator();
    }, [fetchMeCreator]);

    const creatorID = data?.creatorID ?? null;
    const creatorName = useMemo(() => pickCreatorName(data), [data]);
    const avatarSrc = useMemo(() => pickAvatar(data), [data]);
    const bio = data?.bio ?? "";

    const followersCount = useMemo(() => {
        const raw = data?.followers ?? data?.numberOfFollowers ?? 0;
        const num = Number(raw);
        return Number.isFinite(num) ? num : 0;
    }, [data]);

    const songsRaw = useMemo(() => {
        const arr = data?.songs ?? data?.tracks ?? [];
        return Array.isArray(arr) ? arr : [];
    }, [data]);

    const podcastsRaw = useMemo(() => {
        const arr = data?.podcasts ?? data?.episodes ?? [];
        return Array.isArray(arr) ? arr : [];
    }, [data]);

    const albumsRaw = useMemo(() => {
        const arr = data?.albums ?? [];
        return Array.isArray(arr) ? arr : [];
    }, [data]);

    const playlistsRaw = useMemo(() => {
        const arr = data?.playlists ?? data?.publicPlaylists ?? [];
        return Array.isArray(arr) ? arr : [];
    }, [data]);

    const podcastRows = useMemo(() => {
        return podcastsRaw.map((p) => {
            const item = mapPodcastToPlayerItem(p);

            const signedAudio =
                item?.signedAudio ??
                p?.signedAudio ??
                p?.signedUrl ??
                p?.audioURL ??
                p?.fileURL ??
                null;

            const podcastID = p?.podcastID ?? item?.podcastID ?? p?.id ?? null;

            return {
                podcastID,
                title: pickPodcastTitle(p),
                duration: p?.duration ?? null,
                cover: item?.signedCover || pickPodcastCover(p),
                playable: !!signedAudio,
                playerItem: {
                    ...item,
                    podcastID,
                    creatorName: item.creatorName || creatorName || "—",
                    duration: p?.duration ?? item?.duration,
                    signedCover: item?.signedCover || pickPodcastCover(p),
                    signedAudio,
                },
            };
        });
    }, [podcastsRaw, creatorName]);

    const podcastsPlayable = useMemo(
        () => podcastRows.filter((r) => r.playable).map((r) => r.playerItem),
        [podcastRows]
    );

    const canPlayPodcasts = podcastsPlayable.length > 0;

    const isNowPlayingCreator = useMemo(() => {
        if (!currentItem) return false;
        const cName = currentItem.creatorName || "";
        return !!cName && cName === creatorName;
    }, [currentItem, creatorName]);

    const onPlayAllPodcasts = useCallback(() => {
        if (!podcastsPlayable.length) return;
        setNewQueue(podcastsPlayable, 0);
    }, [podcastsPlayable, setNewQueue]);

    const openEditBio = useCallback(() => {
        setEditBio(bio || "");
        setEditOpen(true);
    }, [bio]);

    const saveBio = useCallback(async () => {
        if (!token) {
            showToast("Zaloguj się ponownie", "error");
            return;
        }
        if (!creatorID) {
            showToast("Brak creatorID", "error");
            return;
        }

        setSavingBio(true);
        try {
            await updateMyCreatorBio(token, editBio);
            showToast("Zapisano bio", "success");
            setEditOpen(false);
            await fetchMeCreator();
        } catch (e) {
            showToast(e?.message || "Nie udało się zapisać bio", "error");
        } finally {
            setSavingBio(false);
        }
    }, [token, creatorID, editBio, showToast, fetchMeCreator]);

    if (!token) {
        return (
            <div style={styles.page}>
                <div style={{ opacity: 0.75 }}>Zaloguj się, aby zobaczyć panel twórcy.</div>
            </div>
        );
    }

    if (!isCreatorRole) {
        return (
            <div style={styles.page}>
                <div style={styles.hint}>
                    Ten widok jest dostępny tylko dla roli <b>Creator</b>.
                </div>
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
            <div style={styles.topBar}>
                <button type="button" onClick={() => navigate(-1)} style={styles.backBtn} title="Wstecz">
                    <ArrowLeft size={18} style={{ display: "block" }} />
                </button>

                <div style={{ opacity: 0.75, fontSize: 13 }}>
                    {isNowPlayingCreator ? (isPlaying ? "Teraz odtwarzane" : "Wstrzymane") : "Panel twórcy"}
                </div>
            </div>

            {loading ? <div style={{ opacity: 0.75 }}>Ładowanie…</div> : null}
            {msg ? <div style={styles.hint}>{msg}</div> : null}
            {!loading && !msg && !data ? <div style={styles.hint}>Nie znaleziono profilu twórcy.</div> : null}

            {data ? (
                <>
                    {/* HEADER */}
                    <div style={styles.card}>
                        <div style={styles.profileRow}>
                            <div style={styles.avatarWrap}>
                                {avatarSrc ? (
                                    <img
                                        src={avatarSrc}
                                        alt=""
                                        style={styles.avatarImg}
                                        referrerPolicy="no-referrer"
                                        crossOrigin="anonymous"
                                    />
                                ) : (
                                    <div style={styles.avatarFallback}>
                                        <UserIcon size={54} style={{ display: "block", opacity: 0.9 }} />
                                    </div>
                                )}
                            </div>

                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={styles.kicker}>TWÓRCA</div>

                                <div style={styles.nameRow}>
                                    <h1 style={styles.h1} title={creatorName}>
                                        {creatorName}
                                    </h1>
                                </div>

                                <div style={styles.metaLine}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                        <Users size={14} style={{ display: "block", opacity: 0.85 }} />
                                        <span style={{ opacity: 0.9 }}>{followersCount} obserw.</span>
                                    </span>

                                    <span style={{ opacity: 0.65 }}> • </span>
                                    <span style={{ opacity: 0.9 }}>
                                        {songsRaw.length ? `${songsRaw.length} utw.` : "Brak utworów"}
                                    </span>

                                    <span style={{ opacity: 0.65 }}> • </span>
                                    <span style={{ opacity: 0.9 }}>
                                        {podcastsRaw.length ? `${podcastsRaw.length} pod.` : "Brak podcastów"}
                                    </span>

                                    <span style={{ opacity: 0.65 }}> • </span>
                                    <span style={{ opacity: 0.9 }}>
                                        {albumsRaw.length ? `${albumsRaw.length} alb.` : "Brak albumów"}
                                    </span>

                                    <span style={{ opacity: 0.65 }}> • </span>
                                    <span style={{ opacity: 0.9 }}>
                                        {playlistsRaw.length ? `${playlistsRaw.length} pl.` : "Brak playlist"}
                                    </span>
                                </div>

                                <div style={styles.actions}>
                                    <button type="button" onClick={openEditBio} style={styles.ghostBtn} title="Edytuj bio">
                                        <Pencil size={16} style={{ display: "block" }} />
                                        Edytuj bio
                                    </button>

                                    <button
                                        type="button"
                                        onClick={onPlayAllPodcasts}
                                        disabled={!canPlayPodcasts}
                                        style={{
                                            ...styles.primaryBtn,
                                            opacity: canPlayPodcasts ? 1 : 0.6,
                                            cursor: canPlayPodcasts ? "pointer" : "not-allowed",
                                        }}
                                        title="Odtwórz wszystkie podcasty"
                                    >
                                        <Play size={16} style={{ display: "block" }} />
                                        Odtwórz podcasty
                                    </button>
                                </div>

                                {bio ? <div style={styles.bio}>{bio}</div> : <div style={{ ...styles.bio, opacity: 0.65 }}>Brak opisu.</div>}
                            </div>
                        </div>
                    </div>

                    {/* SONGS MANAGER (UPLOAD/DELETE + refetch) */}
                    <div style={{ ...styles.card, marginTop: 14 }}>
                        <CreatorSongsManager songs={songsRaw} onChanged={fetchMeCreator} />
                    </div>

                    {/* ALBUMS */}
                    <div style={{ ...styles.card, marginTop: 14 }}>
                        <CreatorAlbumsManager albums={data?.albums || []} onChanged={fetchMeCreator} />
                    </div>

                    {/* PLAYLISTS */}
                    <div style={{ ...styles.card, marginTop: 14 }}>
                        <div style={styles.sectionTitleRow}>
                            <ListMusic size={16} style={{ display: "block", opacity: 0.85 }} />
                            <div style={styles.sectionTitle}>Playlisty</div>
                            <div style={{ marginLeft: "auto", opacity: 0.65, fontSize: 12 }}>{playlistsRaw.length}</div>
                        </div>

                        {playlistsRaw.length === 0 ? (
                            <div style={styles.hintInline}>Brak playlist.</div>
                        ) : (
                            <div style={styles.list}>
                                {playlistsRaw.map((p) => {
                                    const cover = pickPlaylistCover(p);
                                    const name = pickPlaylistName(p);
                                    const playlistID = p?.playlistID ?? p?.id;
                                    const count = pickItemsCount(p);

                                    return (
                                        <div
                                            key={playlistID ?? name}
                                            style={styles.item}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => navigate(`/playlists/${playlistID}`)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") navigate(`/playlists/${playlistID}`);
                                            }}
                                            title={name}
                                        >
                                            <div style={styles.itemCover}>
                                                {cover ? (
                                                    <img
                                                        src={cover}
                                                        alt=""
                                                        style={styles.itemCoverImg}
                                                        referrerPolicy="no-referrer"
                                                        crossOrigin="anonymous"
                                                    />
                                                ) : (
                                                    <div style={styles.itemCoverPh} />
                                                )}
                                            </div>

                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={styles.itemTitle}>{name}</div>
                                                <div style={styles.itemSub}>{count != null ? `${count} utw.` : "—"}</div>
                                            </div>

                                            <div style={styles.openHint}>Otwórz</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* PODCASTS */}
                    <div style={{ ...styles.card, marginTop: 14 }}>
                        <CreatorPodcastsManager
                            podcasts={podcastsRaw}
                            onChanged={fetchMeCreator}
                        />
                    </div>
                </>
            ) : null}

            {/* EDIT BIO MODAL */}
            {editOpen ? (
                <div style={styles.modalOverlay} role="dialog" aria-modal="true">
                    <div style={styles.modal}>
                        <div style={styles.modalHeader}>
                            <div style={{ fontWeight: 900 }}>Edytuj bio</div>
                            <button
                                type="button"
                                onClick={() => setEditOpen(false)}
                                style={styles.iconX}
                                title="Zamknij"
                                disabled={savingBio}
                            >
                                <X size={18} style={{ display: "block" }} />
                            </button>
                        </div>

                        <div style={styles.modalBody}>
                            <div style={styles.field}>
                                <div style={styles.label}>Bio</div>
                                <textarea
                                    value={editBio}
                                    onChange={(e) => setEditBio(e.target.value)}
                                    style={styles.textarea}
                                    placeholder="Opisz siebie jako twórcę…"
                                />
                            </div>
                        </div>

                        <div style={styles.modalFooter}>
                            <button type="button" onClick={() => setEditOpen(false)} style={styles.ghostBtn} disabled={savingBio}>
                                Anuluj
                            </button>

                            <button
                                type="button"
                                onClick={saveBio}
                                style={{
                                    ...styles.primaryBtn,
                                    opacity: savingBio ? 0.6 : 1,
                                    cursor: savingBio ? "not-allowed" : "pointer",
                                }}
                                disabled={savingBio}
                            >
                                <Save size={16} style={{ display: "block" }} /> Zapisz
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <div style={{ height: 120 }} />
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        background: "#121212",
        color: "white",
        padding: "20px 40px",
        paddingBottom: 120,
    },

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

    topBar: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 18,
    },

    backBtn: {
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
        cursor: "pointer",
    },

    hint: {
        background: "#1b1b1b",
        border: "1px solid #2a2a2a",
        padding: 12,
        borderRadius: 12,
        opacity: 0.85,
        fontSize: 13,
        marginBottom: 12,
    },

    hintInline: {
        opacity: 0.75,
        fontSize: 13,
        padding: "6px 2px",
    },

    card: {
        background: "#1e1e1e",
        borderRadius: 14,
        border: "1px solid #2a2a2a",
        padding: 16,
    },

    profileRow: { display: "flex", gap: 16, alignItems: "flex-start" },

    avatarWrap: {
        width: 160,
        height: 160,
        borderRadius: 14,
        overflow: "hidden",
        background: "#2a2a2a",
        border: "1px solid #2a2a2a",
        flex: "0 0 auto",
    },
    avatarImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
    avatarFallback: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #2b2b2b, #1f1f1f)",
    },

    kicker: { fontSize: 12, opacity: 0.7, letterSpacing: 1.2, fontWeight: 900 },

    nameRow: { display: "flex", alignItems: "center", gap: 10 },
    h1: {
        margin: "6px 0 8px",
        fontSize: 38,
        lineHeight: 1.08,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },

    metaLine: {
        opacity: 0.9,
        fontSize: 13,
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
    },

    actions: { marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

    primaryBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 12,
        border: "none",
        background: "#1db954",
        color: "#000",
        fontWeight: 900,
        cursor: "pointer",
    },

    ghostBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #333",
        background: "transparent",
        color: "white",
        fontWeight: 800,
        cursor: "pointer",
    },

    bio: {
        marginTop: 14,
        maxWidth: 780,
        lineHeight: 1.55,
        opacity: 0.9,
        whiteSpace: "pre-wrap",
    },

    sectionTitleRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
    sectionTitle: { fontWeight: 900, opacity: 0.95 },

    list: { display: "flex", flexDirection: "column", gap: 10 },

    // list item (albums/playlists)
    item: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "#141414",
        cursor: "pointer",
    },

    itemCover: {
        width: 44,
        height: 44,
        borderRadius: 12,
        overflow: "hidden",
        background: "#2a2a2a",
        flex: "0 0 auto",
    },
    itemCoverImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
    itemCoverPh: { width: "100%", height: "100%", background: "#2a2a2a" },

    itemTitle: { fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    itemSub: { fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    openHint: {
        opacity: 0.55,
        fontSize: 12,
        border: "1px solid #2a2a2a",
        padding: "6px 10px",
        borderRadius: 999,
        userSelect: "none",
    },

    // row (podcasts)
    row: {
        display: "grid",
        gridTemplateColumns: "44px 44px 1fr",
        gap: 12,
        alignItems: "center",
        padding: "10px 8px",
        border: "1px solid #2a2a2a",
        borderRadius: 12,
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
        cursor: "pointer",
    },

    miniCoverWrap: {
        width: 34,
        height: 34,
        borderRadius: 8,
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

    trackMain: { minWidth: 0, overflow: "hidden" },

    trackTitleLink: {
        fontWeight: 900,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        cursor: "pointer",
    },

    trackSub: {
        fontSize: 12,
        opacity: 0.7,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },

    // MODAL
    modalOverlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 2000,
    },

    modal: {
        width: "min(680px, 100%)",
        background: "#1b1b1b",
        border: "1px solid #2a2a2a",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
    },

    modalHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        borderBottom: "1px solid #2a2a2a",
    },

    iconX: {
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
        cursor: "pointer",
    },

    modalBody: { padding: 14, display: "flex", flexDirection: "column", gap: 12 },

    field: { display: "flex", flexDirection: "column", gap: 6 },
    label: { fontSize: 12, opacity: 0.7, fontWeight: 800, letterSpacing: 0.6 },

    textarea: {
        minHeight: 160,
        resize: "vertical",
        borderRadius: 12,
        border: "1px solid #333",
        background: "#141414",
        color: "white",
        padding: "10px 12px",
        outline: "none",
        lineHeight: 1.5,
        fontFamily: "inherit",
    },

    modalFooter: {
        padding: 14,
        borderTop: "1px solid #2a2a2a",
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
    },
};