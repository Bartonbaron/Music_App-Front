import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {ArrowLeft, Music2, Play, User as UserIcon, Users, Mic2, Album as AlbumIcon, ListMusic } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";

import { fetchCreatorProfile, toggleFollowCreator } from "../../api/creators/creators.api.js";
import { mapSongToPlayerItem, mapPodcastToPlayerItem } from "../../utils/playerAdapter";
import { formatTrackDuration } from "../../utils/time";

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

function pickFollowersCount(res) {
    const raw = res?.followers ?? res?.numberOfFollowers ?? res?.creator?.numberOfFollowers ?? 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
}

function pickIsFollowing(res) {
    return typeof res?.isFollowing === "boolean" ? res.isFollowing : false;
}

function pickSongs(res) {
    const arr = res?.songs ?? res?.tracks ?? [];
    return Array.isArray(arr) ? arr : [];
}

function pickPodcasts(res) {
    const arr = res?.podcasts ?? res?.episodes ?? [];
    return Array.isArray(arr) ? arr : [];
}

function pickAlbums(res) {
    const arr = res?.albums ?? [];
    return Array.isArray(arr) ? arr : [];
}

function pickPlaylists(res) {
    const arr = res?.playlists ?? res?.publicPlaylists ?? [];
    return Array.isArray(arr) ? arr : [];
}

function pickAlbumCover(a) {
    return a?.signedCover || a?.coverSigned || a?.coverURL || null;
}
function pickAlbumName(a) {
    return a?.albumName || a?.name || "Album";
}

function pickPlaylistCover(p) {
    return p?.signedCover || p?.coverSigned || p?.coverURL || null;
}
function pickPlaylistName(p) {
    return p?.playlistName || p?.name || "Playlista";
}

export default function PublicCreatorPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token, user } = useAuth();
    const { setNewQueue, currentItem, isPlaying } = usePlayer();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const [toast, setToast] = useState(null);
    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1400);
    }, []);

    // follow state
    const [isFollowing, setIsFollowing] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);
    const [followBusy, setFollowBusy] = useState(false);

    const fetchCreator = useCallback(async () => {
        if (!token) {
            setMsg("Zaloguj się, aby zobaczyć profil twórcy.");
            setData(null);
            return;
        }
        if (!id) {
            setMsg("Brak ID twórcy.");
            setData(null);
            return;
        }

        setLoading(true);
        setMsg("");

        try {
            const res = await fetchCreatorProfile(token, id);
            setData(res);

            setFollowersCount(pickFollowersCount(res));
            setIsFollowing(pickIsFollowing(res));
        } catch (e) {
            setMsg(e?.message || "Nie udało się pobrać twórcy.");
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [token, id]);

    useEffect(() => {
        fetchCreator();
    }, [fetchCreator]);

    const creatorName = useMemo(() => pickCreatorName(data), [data]);
    const avatarSrc = useMemo(() => pickAvatar(data), [data]);
    const bio = data?.bio ?? "";

    const myUserID = Number(user?.userID ?? user?.id);
    const creatorUserID = Number(
        data?.userID ??
        data?.id ??
        data?.user?.userID ??
        data?.user?.id ??
        data?.creator?.user?.userID
    );

    const isSelf =
        Number.isFinite(myUserID) &&
        Number.isFinite(creatorUserID) &&
        myUserID === creatorUserID;

    // raw arrays from backend
    const songsRaw = useMemo(() => pickSongs(data), [data]);
    const podcastsRaw = useMemo(() => pickPodcasts(data), [data]);
    const albums = useMemo(() => pickAlbums(data), [data]);
    const playlists = useMemo(() => pickPlaylists(data), [data]);

    // playable queues
    const songsPlayable = useMemo(() => {
        return songsRaw
            .map((s) => ({ ...s, creatorName: s.creatorName ?? creatorName }))
            .map(mapSongToPlayerItem)
            .filter((x) => {
                const status = String(x?.moderationStatus || "ACTIVE").toUpperCase();
                return !!x?.signedAudio && status !== "HIDDEN";
            });
    }, [songsRaw, creatorName]);

    const podcastsPlayable = useMemo(() => {
        return podcastsRaw
            .map((p) => ({
                ...p,
                creatorName: p.creatorName ?? creatorName,
                moderationStatus: p?.moderationStatus ?? "ACTIVE",
            }))
            .map(mapPodcastToPlayerItem)
            .filter((x) => !!x?.signedAudio && String(x?.moderationStatus).toUpperCase() !== "HIDDEN");
    }, [podcastsRaw, creatorName]);

    const canPlayAllSongs = songsPlayable.length > 0;
    const canPlayAllPodcasts = podcastsPlayable.length > 0;

    const isNowPlayingCreator = useMemo(() => {
        if (!currentItem) return false;
        const cName = currentItem.creatorName || "";
        return Boolean(cName && cName === creatorName);
    }, [currentItem, creatorName]);

    const onToggleFollow = useCallback(async () => {
        if (!token) {
            showToast("Zaloguj się ponownie", "error");
            return;
        }
        if (!id) return;

        setFollowBusy(true);
        try {
            const res = await toggleFollowCreator(token, id);

            if (typeof res?.isFollowing === "boolean") setIsFollowing(res.isFollowing);

            const followers = pickFollowersCount(res);
            setFollowersCount(followers);

            showToast(res?.isFollowing ? "Obserwujesz twórcę" : "Przestano obserwować", "success");
        } catch (e) {
            showToast(e?.message || "Błąd obserwowania", "error");
        } finally {
            setFollowBusy(false);
        }
    }, [token, id, showToast]);

    const onPlayAllSongs = useCallback(() => {
        if (!songsPlayable.length) return;
        setNewQueue(songsPlayable, 0);
    }, [songsPlayable, setNewQueue]);

    const onPlaySongAt = useCallback(
        (songID) => {
            if (!songsPlayable.length) return;
            const idx = songsPlayable.findIndex((x) => String(x.songID) === String(songID));
            if (idx < 0) return;
            setNewQueue(songsPlayable, idx);
        },
        [songsPlayable, setNewQueue]
    );

    const onPlayAllPodcasts = useCallback(() => {
        if (!podcastsPlayable.length) return;
        setNewQueue(podcastsPlayable, 0);
    }, [podcastsPlayable, setNewQueue]);

    const onPlayPodcastAt = useCallback(
        (podcastID) => {
            if (!podcastsPlayable.length) return;
            const idx = podcastsPlayable.findIndex((x) => String(x.podcastID) === String(podcastID));
            if (idx < 0) return;
            setNewQueue(podcastsPlayable, idx);
        },
        [podcastsPlayable, setNewQueue]
    );

    if (!token) {
        return (
            <div style={styles.page}>
                <div style={{ opacity: 0.75 }}>Zaloguj się, aby zobaczyć profil twórcy.</div>
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
                    {isNowPlayingCreator ? (isPlaying ? "Teraz odtwarzane" : "Wstrzymane") : "Twórca"}
                </div>
            </div>

            {loading ? <div style={{ opacity: 0.75 }}>Ładowanie…</div> : null}
            {msg ? <div style={styles.hint}>{msg}</div> : null}
            {!loading && !msg && !data ? <div style={styles.hint}>Nie znaleziono twórcy.</div> : null}

            {data ? (
                <>
                    {/* HEADER CARD */}
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
                                        <span style={{ opacity: 0.9 }}>{followersCount} obser.</span>
                                    </span>

                                    <span style={{ opacity: 0.65 }}> • </span>
                                    <span style={{ opacity: 0.9 }}>{songsRaw.length ? `${songsRaw.length} utw.` : "Brak utworów"}</span>

                                    <span style={{ opacity: 0.65 }}> • </span>
                                    <span style={{ opacity: 0.9 }}>
                                        {podcastsRaw.length ? `${podcastsRaw.length} pod.` : "Brak podcastów"}
                                    </span>
                                </div>

                                <div style={styles.actions}>
                                    {!isSelf ? (
                                        <button
                                            type="button"
                                            onClick={onToggleFollow}
                                            disabled={followBusy}
                                            style={{
                                                ...styles.followBtn,
                                                opacity: followBusy ? 0.65 : 1,
                                                cursor: followBusy ? "not-allowed" : "pointer",
                                                background: isFollowing ? "#1a1a1a" : "#1db954",
                                                color: isFollowing ? "white" : "#000",
                                                border: isFollowing ? "1px solid #333" : "none",
                                            }}
                                            title={isFollowing ? "Kliknij, aby przestać obserwować" : "Kliknij, aby obserwować"}
                                        >
                                            {followBusy ? "…" : isFollowing ? "Obserwujesz" : "Obserwuj"}
                                        </button>
                                    ) : null}

                                    <button
                                        type="button"
                                        onClick={onPlayAllSongs}
                                        disabled={!canPlayAllSongs}
                                        style={{
                                            ...styles.primaryBtn,
                                            opacity: canPlayAllSongs ? 1 : 0.6,
                                            cursor: canPlayAllSongs ? "pointer" : "not-allowed",
                                        }}
                                        title="Odtwórz wszystkie utwory"
                                    >
                                        <Play size={16} style={{ display: "block" }} />
                                        Odtwórz utwory
                                    </button>

                                    <button
                                        type="button"
                                        onClick={onPlayAllPodcasts}
                                        disabled={!canPlayAllPodcasts}
                                        style={{
                                            ...styles.primaryBtn,
                                            opacity: canPlayAllPodcasts ? 1 : 0.6,
                                            cursor: canPlayAllPodcasts ? "pointer" : "not-allowed",
                                        }}
                                        title="Odtwórz wszystkie podcasty"
                                    >
                                        <Play size={16} style={{ display: "block" }} />
                                        Odtwórz podcasty
                                    </button>
                                </div>

                                {bio ? (
                                    <div style={styles.bio}>{bio}</div>
                                ) : (
                                    <div style={{ ...styles.bio, opacity: 0.65 }}>Brak opisu.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ALBUMS */}
                    <div style={{ ...styles.card, marginTop: 14 }}>
                        <div style={styles.sectionTitleRow}>
                            <AlbumIcon size={16} style={{ display: "block", opacity: 0.85 }} />
                            <div style={styles.sectionTitle}>Albumy</div>
                            <div style={{ marginLeft: "auto", opacity: 0.65, fontSize: 12 }}>{albums.length}</div>
                        </div>

                        {albums.length === 0 ? (
                            <div style={styles.hintInline}>Brak albumów.</div>
                        ) : (
                            <div style={styles.grid}>
                                {albums.map((a) => {
                                    const cover = pickAlbumCover(a);
                                    const name = pickAlbumName(a);
                                    const albumID = a?.albumID ?? a?.id;

                                    const hidden = String(a?.moderationStatus || "ACTIVE").toUpperCase() === "HIDDEN";
                                    const statusLabel = hidden ? "HIDDEN" : null;

                                    const go = () => {
                                        if (hidden || !albumID) return;
                                        navigate(`/albums/${albumID}`);
                                    };

                                    return (
                                        <div
                                            key={albumID ?? name}
                                            style={{
                                                ...styles.gridCard,
                                                ...(hidden ? styles.rowDisabled : null),
                                                cursor: hidden ? "not-allowed" : "pointer",
                                            }}
                                            role="button"
                                            tabIndex={hidden ? -1 : 0}
                                            onClick={go}
                                            onKeyDown={(e) => {
                                                if (hidden) return;
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    go();
                                                }
                                            }}
                                            title={hidden ? "Album ukryty przez administrację" : name}
                                        >
                                            <div style={styles.gridCardTop}>
                                                {cover ? (
                                                    <img
                                                        src={cover}
                                                        alt=""
                                                        style={styles.gridCoverImg}
                                                        referrerPolicy="no-referrer"
                                                        crossOrigin="anonymous"
                                                    />
                                                ) : (
                                                    <div style={styles.gridCoverPh} />
                                                )}

                                                {statusLabel ? (
                                                    <div style={styles.badgePill} title={statusLabel}>
                                                        {statusLabel}
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div style={styles.gridName}>{name}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* PLAYLISTS */}
                    <div style={{ ...styles.card, marginTop: 14 }}>
                        <div style={styles.sectionTitleRow}>
                            <ListMusic size={16} style={{ display: "block", opacity: 0.85 }} />
                            <div style={styles.sectionTitle}>Playlisty</div>
                            <div style={{ marginLeft: "auto", opacity: 0.65, fontSize: 12 }}>{playlists.length}</div>
                        </div>

                        {playlists.length === 0 ? (
                            <div style={styles.hintInline}>Brak playlist.</div>
                        ) : (
                            <div style={styles.grid}>
                                {playlists.map((p) => {
                                    const cover = pickPlaylistCover(p);
                                    const name = pickPlaylistName(p);
                                    const playlistID = p?.playlistID ?? p?.id;

                                    const hidden = String(p?.moderationStatus || "ACTIVE").toUpperCase() === "HIDDEN";
                                    const statusLabel = hidden ? "HIDDEN" : null;

                                    const go = () => {
                                        if (hidden || !playlistID) return;
                                        navigate(`/playlists/${playlistID}`);
                                    };

                                    return (
                                        <div
                                            key={playlistID ?? name}
                                            style={{
                                                ...styles.gridCard,
                                                ...(hidden ? styles.rowDisabled : null),
                                                cursor: hidden ? "not-allowed" : "pointer",
                                            }}
                                            role="button"
                                            tabIndex={hidden ? -1 : 0}
                                            onClick={go}
                                            onKeyDown={(e) => {
                                                if (hidden) return;
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    go();
                                                }
                                            }}
                                            title={hidden ? "Playlista ukryta przez administrację" : name}
                                        >
                                            <div style={styles.gridCardTop}>
                                                {cover ? (
                                                    <img
                                                        src={cover}
                                                        alt=""
                                                        style={styles.gridCoverImg}
                                                        referrerPolicy="no-referrer"
                                                        crossOrigin="anonymous"
                                                    />
                                                ) : (
                                                    <div style={styles.gridCoverPh} />
                                                )}

                                                {statusLabel ? (
                                                    <div style={styles.badgePill} title={statusLabel}>
                                                        {statusLabel}
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div style={styles.gridName}>{name}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* SONGS */}
                    <div style={{ ...styles.card, marginTop: 14 }}>
                        <div style={styles.sectionTitleRow}>
                            <Music2 size={16} style={{ display: "block", opacity: 0.85 }} />
                            <div style={styles.sectionTitle}>Utwory</div>
                            <div style={{ marginLeft: "auto", opacity: 0.65, fontSize: 12 }}>{songsRaw.length}</div>
                        </div>

                        {songsRaw.length === 0 ? (
                            <div style={styles.hintInline}>Brak utworów.</div>
                        ) : (
                            <div style={styles.list}>
                                {songsRaw.map((s, idx) => {

                                    const hidden = String(s?.moderationStatus || "ACTIVE").toUpperCase() === "HIDDEN";
                                    const playable = !hidden && songsPlayable.some((x) => String(x.songID) === String(s.songID));


                                    const cover = s?.signedCover || s?.coverURL || null;

                                    const statusLabel = hidden
                                        ? "Ukryty"
                                        : playable
                                            ? null
                                            : "Brak audio";

                                    return (
                                        <div
                                            key={s.songID ?? idx}
                                            style={{
                                                ...styles.row,
                                                ...(hidden ? styles.rowDisabled : null),
                                            }}
                                        >
                                            {/* PLAY */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!playable) return;
                                                    onPlaySongAt(s.songID);
                                                }}
                                                disabled={!playable}
                                                style={{
                                                    ...styles.rowPlayBtn,
                                                    opacity: playable ? 1 : 0.45,
                                                    cursor: playable ? "pointer" : "not-allowed",
                                                }}
                                                title={
                                                    hidden
                                                        ? "Utwór ukryty przez administrację"
                                                        : playable
                                                            ? "Odtwórz"
                                                            : "Brak audio"
                                                }
                                            >
                                                ▶
                                            </button>

                                            {/* COVER */}
                                            <div
                                                style={{
                                                    ...styles.miniCoverWrap,
                                                    ...(hidden ? styles.miniCoverDisabled : null),
                                                }}
                                            >
                                                {cover ? (
                                                    <img
                                                        src={cover}
                                                        alt=""
                                                        style={styles.miniCoverImg}
                                                        referrerPolicy="no-referrer"
                                                        crossOrigin="anonymous"
                                                    />
                                                ) : (
                                                    <div style={styles.miniCoverPh} />
                                                )}
                                            </div>

                                            {/* MAIN */}
                                            <div style={styles.trackMain}>
                                                <div
                                                    style={{
                                                        ...styles.trackTitleLink,
                                                        ...(hidden ? styles.rowTitleDisabled : null),
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 10,
                                                        cursor: hidden ? "not-allowed" : "pointer",
                                                    }}
                                                    role="button"
                                                    tabIndex={hidden ? -1 : 0}
                                                    title={hidden ? "Utwór ukryty przez administrację" : "Otwórz szczegóły"}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (hidden) return;
                                                        navigate(`/songs/${s.songID}`);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            if (hidden) return;
                                                            navigate(`/songs/${s.songID}`);
                                                        }
                                                    }}
                                                >
                                                <span
                                                    style={{
                                                        minWidth: 0,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                    >
                                                    {s.songName || "Utwór"}
                                                    </span>

                                                    {statusLabel ? (
                                                        <span
                                                            style={{
                                                                fontSize: 12,
                                                                fontWeight: 900,
                                                                padding: "4px 8px",
                                                                borderRadius: 999,
                                                                border: "1px solid #333",
                                                                background: "#121212",
                                                                opacity: 0.85,
                                                                flex: "0 0 auto",
                                                            }}
                                                            title={statusLabel}
                                                        >
                                                            {statusLabel}
                                                        </span>
                                                    ) : null}
                                                </div>

                                                <div style={styles.trackSub}>
                                                    {formatTrackDuration(s.duration)}
                                                    {hidden ? <span style={{ opacity: 0.65 }}> • niedostępny</span> : null}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* PODCASTS */}
                    <div style={{ ...styles.card, marginTop: 14 }}>
                        <div style={styles.sectionTitleRow}>
                            <Mic2 size={16} style={{ display: "block", opacity: 0.85 }} />
                            <div style={styles.sectionTitle}>Podcasty</div>
                            <div style={{ marginLeft: "auto", opacity: 0.65, fontSize: 12 }}>{podcastsRaw.length}</div>
                        </div>

                        {podcastsRaw.length === 0 ? (
                            <div style={styles.hintInline}>Brak podcastów.</div>
                        ) : (
                            <div style={styles.list}>
                                {podcastsRaw.map((p, idx) => {
                                    const hidden = String(p?.moderationStatus || "ACTIVE").toUpperCase() === "HIDDEN";
                                    const playable = !hidden && podcastsPlayable.some((x) => String(x.podcastID) === String(p.podcastID));

                                    const cover = p?.signedCover || p?.coverURL || null;
                                    const statusLabel = hidden ? "Ukryty" : null;

                                    return (
                                        <div
                                            key={p.podcastID ?? idx}
                                            style={{
                                                ...styles.row,
                                                ...(hidden ? styles.rowDisabled : null),
                                            }}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!playable) return;
                                                    onPlayPodcastAt(p.podcastID);
                                                }}
                                                disabled={!playable}
                                                style={{
                                                    ...styles.rowPlayBtn,
                                                    opacity: playable ? 1 : 0.45,
                                                    cursor: playable ? "pointer" : "not-allowed",
                                                }}
                                                title={
                                                    hidden
                                                        ? "Podcast ukryty przez administrację"
                                                        : playable
                                                            ? "Odtwórz"
                                                            : "Brak audio"
                                                }
                                            >
                                                ▶
                                            </button>

                                            <div style={styles.miniCoverWrap}>
                                                {cover ? (
                                                    <img
                                                        src={cover}
                                                        alt=""
                                                        style={styles.miniCoverImg}
                                                        referrerPolicy="no-referrer"
                                                        crossOrigin="anonymous"
                                                    />
                                                ) : (
                                                    <div style={styles.miniCoverPh} />
                                                )}
                                            </div>

                                            <div style={styles.trackMain}>
                                                <div
                                                    style={{
                                                        ...styles.trackTitleLink,
                                                        cursor: hidden ? "not-allowed" : "pointer",
                                                        pointerEvents: hidden ? "none" : "auto",
                                                        opacity: hidden ? 0.9 : 1,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 10,
                                                    }}
                                                    role="button"
                                                    tabIndex={0}
                                                    title={hidden ? "Podcast ukryty przez moderację" : "Otwórz szczegóły"}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (hidden) return;
                                                        navigate(`/podcasts/${p.podcastID}`);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            if (hidden) return;
                                                            navigate(`/podcasts/${p.podcastID}`);
                                                        }
                                                    }}
                                                >
                                                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {p.podcastName || "Podcast"}
                                                </span>

                                                    {statusLabel ? (
                                                        <span
                                                            style={{
                                                                fontSize: 12,
                                                                fontWeight: 900,
                                                                padding: "4px 8px",
                                                                borderRadius: 999,
                                                                border: "1px solid #333",
                                                                background: "#121212",
                                                                opacity: 0.9,
                                                                flex: "0 0 auto",
                                                            }}
                                                            title={statusLabel}
                                                        >
                                                        {statusLabel}
                                                        </span>
                                                    ) : null}
                                                </div>

                                                <div style={styles.trackSub}>
                                                    {formatTrackDuration(p.duration)}
                                                    {hidden ? <span style={{ opacity: 0.65 }}> • niedostępny</span> : null}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
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

    topBar: { display: "flex", alignItems: "center", gap: 12, marginBottom: 18 },

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

    hintInline: { opacity: 0.75, fontSize: 13, padding: "6px 2px" },

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
        fontWeight: 900,
        cursor: "pointer",
    },

    followBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 14px",
        borderRadius: 12,
        fontWeight: 900,
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

    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 14,
    },

    gridCard: {
        background: "#141414",
        border: "1px solid #2a2a2a",
        borderRadius: 14,
        overflow: "hidden",
        cursor: "pointer",
    },

    gridCardTop: {
        width: "100%",
        aspectRatio: "1 / 1",
        background: "#2a2a2a",
        overflow: "hidden",
    },

    gridCoverImg: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center",
        display: "block",
    },

    gridCoverPh: {
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #2b2b2b, #1f1f1f)",
    },

    gridName: {
        padding: 10,
        fontWeight: 900,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },

    list: { display: "flex", flexDirection: "column", gap: 10 },

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

    trackTitleLink: {
        fontWeight: 900,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        cursor: "pointer",
        textDecoration: "none",
    },

    rowDisabled: {
        opacity: 0.55,
        filter: "grayscale(0.2)",
    },

    rowTitleDisabled: {
        opacity: 0.85,
    },

    miniCoverDisabled: {
        opacity: 0.65,
        filter: "grayscale(0.5)",
    },

    miniCoverImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
    miniCoverPh: { width: "100%", height: "100%", background: "#2a2a2a" },

    trackMain: { minWidth: 0, overflow: "hidden" },
    trackTitle: { fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    trackSub: { fontSize: 12, opacity: 0.7 },
};