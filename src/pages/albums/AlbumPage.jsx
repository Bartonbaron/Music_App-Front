import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Trash2, Play, X, Save, Image as ImageIcon, Pencil, Music2, ArrowUp, ArrowDown, Flag } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useLibrary } from "../../contexts/LibraryContext";
import {addSongToQueue} from "../../api/playback/queue.api.js";

import LikeButton from "../../components/social/LikeButton.jsx";
import AddToPlaylistModal from "../../components/playlists/AddToPlaylistModal.jsx";
import SongActionsModal from "../../components/actions/SongActionsModal.jsx";

import { mapSongToPlayerItem } from "../../utils/playerAdapter";
import { formatTrackDuration, formatTotalDuration } from "../../utils/time.js";

import { apiFetch } from "../../api/http";

function formatFullDate(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;

    return d.toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function toDateInputValue(d) {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function pickSongTitle(s) {
    return s?.songName || s?.title || "Utwór";
}
function pickDuration(seconds) {
    const n = Number(seconds);
    if (!Number.isFinite(n) || n <= 0) return "—";
    const m = Math.floor(n / 60);
    const s = Math.floor(n % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AlbumPage() {
    const { id } = useParams();
    const { token, user } = useAuth();
    const { setNewQueue } = usePlayer();
    const { albums: libraryAlbums, toggleAlbumInLibrary } = useLibrary();
    const { refetchServerQueue } = usePlayer();

    const [album, setAlbum] = useState(null);
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");
    const [reorderMode, setReorderMode] = useState(false);
    const [reorderBusy, setReorderBusy] = useState(false);
    const [draftSongs, setDraftSongs] = useState([]); // lokalna lista do edycji kolejności

    const [savingLibrary, setSavingLibrary] = useState(false);

    const [toast, setToast] = useState(null);
    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1400);
    }, []);

    // modale: menu akcji utworu (playlist)
    const [addOpen, setAddOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeSong, setActiveSong] = useState(null);
    const [menuBusy, setMenuBusy] = useState(false);

    // modale właściciela
    const [editAlbumOpen, setEditAlbumOpen] = useState(false);
    const [manageTracksOpen, setManageTracksOpen] = useState(false);

    const refresh = useCallback(async () => {
        if (!token) return;

        setLoading(true);
        setMsg("");

        try {
            const a = await apiFetch(`/albums/${id}`, { token });
            const s = await apiFetch(`/albums/${id}/songs`, { token });

            setAlbum(a || null);
            setSongs(Array.isArray(s?.songs) ? s.songs : []);
        } catch (e) {
            const rd = e?.data?.releaseDate;
            if (rd) {
                showToast(
                    `${e.message} ${new Date(rd).toLocaleDateString("pl-PL")}`,
                    "error"
                );
            } else {
                showToast(e?.message || "Błąd", "error");
            }
            setMsg(e?.message || "Błąd");
        } finally {
            setLoading(false);
        }
    }, [id, showToast, token]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const isInLibrary = useMemo(() => {
        return (libraryAlbums || []).some((a) => String(a.albumID) === String(id));
    }, [libraryAlbums, id]);

    const albumCover = album?.signedCover || null;
    const albumArtist = album?.creator?.user?.userName || album?.creatorName || null;

    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState("");
    const [reportBusy, setReportBusy] = useState(false);

    const submitReport = useCallback(async () => {
        if (!token || !album?.albumID) return;

        const reason = reportReason.trim();
        if (reason.length < 3) {
            showToast("Podaj powód (min. 3 znaki)", "error");
            return;
        }

        setReportBusy(true);
        try {
            await apiFetch("/reports", {
                token,
                method: "POST",
                body: {
                    contentType: "album",
                    contentID: Number(album.albumID),
                    reason: reason.slice(0, 255),
                },
            });

            showToast("Zgłoszenie wysłane", "success");
            setReportOpen(false);
            setReportReason("");
        } catch (e) {
            showToast(e?.message || "Nie udało się wysłać zgłoszenia", "error");
        } finally {
            setReportBusy(false);
        }
    }, [token, album?.albumID, reportReason, showToast]);

    const releaseDateLabel = useMemo(() => {
        return formatFullDate(album?.releaseDate || album?.createdAt);
    }, [album?.releaseDate, album?.createdAt]);

    const sortedSongs = useMemo(() => {
        const list = Array.isArray(songs) ? songs.slice() : [];
        const hasTrackNumbers = list.some((x) => x?.trackNumber != null);
        if (!hasTrackNumbers) return list;
        return list.sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
    }, [songs]);

    const queueItems = useMemo(() => {
        return (sortedSongs || [])
            .map((s) => {
                const mapped = mapSongToPlayerItem(s);
                return {
                    ...mapped,
                    type: "song",
                    signedCover: albumCover || mapped.signedCover,
                    creatorName: albumArtist || mapped.creatorName || mapped.artistName || null,
                    songName: s.songName ?? mapped.title,
                    songID: s.songID ?? mapped.songID,
                    duration: s.duration ?? mapped.duration,
                    isHidden: !!s?.isHidden || s?.moderationStatus === "HIDDEN",
                    moderationStatus: s?.moderationStatus,
                };
            })
            .filter((x) => !!x.signedAudio && !x.isHidden);
    }, [sortedSongs, albumCover, albumArtist]);

    const queueIndexBySongId = useMemo(() => {
        const m = new Map();
        queueItems.forEach((q, i) => m.set(String(q.songID), i));
        return m;
    }, [queueItems]);

    const totalDuration = useMemo(() => {
        return (sortedSongs || []).reduce((acc, s) => {
            const d = Number(s?.duration);
            return acc + (Number.isFinite(d) ? d : 0);
        }, 0);
    }, [sortedSongs]);

    const playAlbum = useCallback(() => {
        if (!queueItems.length) return;
        setNewQueue(queueItems, 0);
    }, [queueItems, setNewQueue]);

    const beginReorder = useCallback(() => {
        setDraftSongs(Array.isArray(sortedSongs) ? sortedSongs.slice() : []);
        setReorderMode(true);
    }, [sortedSongs]);

    const cancelReorder = useCallback(() => {
        if (reorderBusy) return;
        setReorderMode(false);
        setDraftSongs([]);
    }, [reorderBusy]);

    const moveDraft = useCallback((fromIdx, toIdx) => {
        setDraftSongs((prev) => {
            const arr = prev.slice();
            if (fromIdx < 0 || toIdx < 0 || fromIdx >= arr.length || toIdx >= arr.length) return prev;
            const [item] = arr.splice(fromIdx, 1);
            arr.splice(toIdx, 0, item);
            return arr;
        });
    }, []);

    const saveReorder = useCallback(async () => {
        if (!token) return;
        if (!id) return;

        const order = (draftSongs || [])
            .map((s) => s?.songID)
            .filter((x) => x != null);

        if (!order.length) {
            showToast("Brak utworów do zapisania", "error");
            return;
        }

        setReorderBusy(true);
        try {
            const res = await fetch(`http://localhost:3000/api/albums/${id}/songs/reorder`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ order }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Nie udało się zapisać kolejności");

            showToast("Kolejność zapisania", "success");

            setSongs(draftSongs.map((s, i) => ({ ...s, trackNumber: i + 1 })));

            setReorderMode(false);
            setDraftSongs([]);
        } catch (e) {
            showToast(e?.message || "Błąd zapisu kolejności", "error");
        } finally {
            setReorderBusy(false);
        }
    }, [token, id, draftSongs, showToast]);

    const shownSongs = reorderMode ? draftSongs : sortedSongs;

    const toggleLibrary = useCallback(async () => {
        if (!token) return;
        if (!toggleAlbumInLibrary) {
            showToast("Brak toggleAlbumInLibrary w LibraryContext", "error");
            return;
        }

        setSavingLibrary(true);
        try {
            const result = await toggleAlbumInLibrary(id, isInLibrary);
            if (result?.success) {
                showToast(isInLibrary ? "Usunięto z biblioteki" : "Dodano do biblioteki", "success");
            } else {
                showToast(result?.message || "Błąd biblioteki", "error");
            }
        } catch (e) {
            const rd = e?.data?.releaseDate;
            if (rd) {
                showToast(
                    `${e.message} ${new Date(rd).toLocaleDateString("pl-PL")}`,
                    "error"
                );
            } else {
                showToast(e?.message || "Błąd biblioteki", "error");
            }
        } finally {
            setSavingLibrary(false);
        }
    }, [token, toggleAlbumInLibrary, id, isInLibrary, showToast]);

    const deleteCover = useCallback(async () => {
        if (!token) return;
        if (!id) return;

        const ok = window.confirm("Usunąć okładkę albumu? (plik zostanie usunięty z S3)");
        if (!ok) return;

        try {
            await fetch(`http://localhost:3000/api/albums/${id}/cover`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            }).then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.message || "Nie udało się usunąć okładki");
                return data;
            });

            showToast("Okładka usunięta", "success");

            setAlbum((prev) => (prev ? { ...prev, coverURL: null, signedCover: null } : prev));
        } catch (e) {
            showToast(e?.message || "Nie udało się usunąć okładki", "error");
        }
    }, [token, id, showToast]);

    const openSongMenu = useCallback((songID, title) => {
        setActiveSong({ songID, title });
        setMenuOpen(true);
    }, []);

    const handleAddToQueue = useCallback(async () => {
        const songID = activeSong?.songID;
        if (!token || !songID) return;

        setMenuBusy(true);
        try {
            await addSongToQueue(token, songID, "END");
            await refetchServerQueue();
            showToast?.("Dodano do kolejki", "success");
            setMenuOpen(false);
        } catch (e) {
            showToast?.(e?.message || "Błąd dodawania do kolejki", "error");
        } finally {
            setMenuBusy(false);
        }
    }, [token, activeSong?.songID, showToast, refetchServerQueue]);

    const handlePlayNext = useCallback(async () => {
        const songID = activeSong?.songID;
        if (!token || !songID) return;

        setMenuBusy(true);
        try {
            await addSongToQueue(token, songID, "NEXT");
            await refetchServerQueue(); // <--- TO JEST KLUCZ
            showToast?.("Ustawiono jako następny", "success");
            setMenuOpen(false);
        } catch (e) {
            showToast?.(e?.message || "Błąd ustawiania następnego", "error");
        } finally {
            setMenuBusy(false);
        }
    }, [token, activeSong?.songID, showToast, refetchServerQueue]);

    const isOwner = useMemo(() => {
        const albumCreatorUserID = album?.creator?.userID ?? album?.creator?.user?.userID ?? null;
        const myUserID = user?.userID ?? user?.id ?? null;

        if (albumCreatorUserID != null && myUserID != null) {
            return String(albumCreatorUserID) === String(myUserID);
        }

        if (album?.isOwner === true) return true;

        return false;
    }, [album, user]);

    // OWNER: Edit Album Modal
    const [editBusy, setEditBusy] = useState(false);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editReleaseDate, setEditReleaseDate] = useState("");
    const [editCoverFile, setEditCoverFile] = useState(null);
    const editCoverRef = useRef(null);

    const editCoverPreview = useMemo(() => {
        if (!editCoverFile) return null;
        return URL.createObjectURL(editCoverFile);
    }, [editCoverFile]);

    useEffect(() => {
        return () => {
            if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
        };
    }, [editCoverPreview]);

    const openEditAlbum = useCallback(() => {
        setEditName(String(album?.albumName || ""));
        setEditDescription(String(album?.description || ""));
        setEditReleaseDate(toDateInputValue(album?.releaseDate));
        setEditCoverFile(null);
        if (editCoverRef.current) editCoverRef.current.value = "";
        setEditAlbumOpen(true);
    }, [album]);

    const closeEditAlbum = useCallback(() => {
        if (editBusy) return;
        setEditAlbumOpen(false);
    }, [editBusy]);

    const saveAlbumEdit = useCallback(async () => {
        if (!token) return;

        const nameTrim = String(editName || "").trim();
        if (!nameTrim) {
            showToast("Nazwa albumu nie może być pusta", "error");
            return;
        }

        setEditBusy(true);
        try {
            // PATCH meta
            await apiFetch(`/albums/${id}`, {
                token,
                method: "PATCH",
                body: {
                    albumName: nameTrim,
                    description: String(editDescription || "").trim() || null,
                    releaseDate: editReleaseDate || null,
                },
            });

            // cover upload (opcjonalnie)
            if (editCoverFile) {
                const fd = new FormData();
                fd.append("cover", editCoverFile);

                await apiFetch(`/albums/${id}/cover`, {
                    token,
                    method: "POST",
                    body: fd,
                });
            }

            showToast("Zapisano album", "success");
            setEditAlbumOpen(false);
            await refresh();
        } catch (e) {
            showToast(e?.message || "Nie udało się zapisać", "error");
        } finally {
            setEditBusy(false);
        }
    }, [token, id, editName, editDescription, editReleaseDate, editCoverFile, showToast, refresh]);

    const deleteAlbum = useCallback(async () => {
        if (!token) return;

        const ok = window.confirm("Na pewno usunąć ten album? Tej operacji nie da się cofnąć.");
        if (!ok) return;

        try {
            await apiFetch(`/albums/${id}`, { token, method: "DELETE" });
            showToast("Album usunięty", "success");
            // możesz tu zrobić navigate(-1) jeśli chcesz, ale nie mam importu navigate w tym pliku
        } catch (e) {
            showToast(e?.message || "Nie udało się usunąć albumu", "error");
        }
    }, [token, id, showToast]);

    // OWNER: Manage Tracks Modal
    const [tracksBusy, setTracksBusy] = useState(false);

    // wolne utwory do przypięcia
    const [availableSongs, setAvailableSongs] = useState([]);
    const [availableLoading, setAvailableLoading] = useState(false);
    const [pick, setPick] = useState(new Set()); // songID strings
    const [search, setSearch] = useState("");

    const openManageTracks = useCallback(async () => {
        setManageTracksOpen(true);
    }, []);

    const closeManageTracks = useCallback(() => {
        if (tracksBusy) return;
        setManageTracksOpen(false);
    }, [tracksBusy]);

    const loadAvailableSongs = useCallback(async () => {
        if (!token) return;
        setAvailableLoading(true);
        try {
            const res = await apiFetch(`/songs/my?unassigned=1`, { token });
            setAvailableSongs(Array.isArray(res?.songs) ? res.songs : []);
        } catch (e) {
            console.warn("LOAD AVAILABLE SONGS ERROR:", e);
            setAvailableSongs([]);
        } finally {
            setAvailableLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (!manageTracksOpen) return;
        setPick(new Set());
        setSearch("");
        loadAvailableSongs();
    }, [manageTracksOpen, loadAvailableSongs]);

    const filteredAvailable = useMemo(() => {
        const q = String(search || "").trim().toLowerCase();
        const arr = Array.isArray(availableSongs) ? availableSongs : [];
        if (!q) return arr;

        return arr.filter((s) => {
            const name = String(pickSongTitle(s) || "").toLowerCase();
            return name.includes(q);
        });
    }, [availableSongs, search]);

    const togglePick = useCallback((songID) => {
        const idStr = String(songID);
        setPick((prev) => {
            const next = new Set(prev);
            if (next.has(idStr)) next.delete(idStr);
            else next.add(idStr);
            return next;
        });
    }, []);

    const addPickedToAlbum = useCallback(async () => {
        if (!token) return;
        if (!pick.size) {
            showToast("Zaznacz utwory do dodania", "error");
            return;
        }

        setTracksBusy(true);
        try {
            const songIDs = Array.from(pick).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);

            await apiFetch(`/albums/${id}/songs`, {
                token,
                method: "POST",
                body: { songIDs },
            });

            showToast("Dodano utwory do albumu", "success");
            setPick(new Set());

            // odśwież oba listy
            await refresh();
            await loadAvailableSongs();
        } catch (e) {
            showToast(e?.message || "Nie udało się dodać utworów", "error");
        } finally {
            setTracksBusy(false);
        }
    }, [token, id, pick, showToast, refresh, loadAvailableSongs]);

    const removeFromAlbum = useCallback(
        async (songID) => {
            if (!token) return;

            const ok = window.confirm("Usunąć ten utwór z albumu? (utwór nadal zostanie w Twoich utworach)");
            if (!ok) return;

            setTracksBusy(true);
            try {
                await apiFetch(`/albums/${id}/songs/${songID}`, {
                    token,
                    method: "DELETE",
                });

                showToast("Usunięto z albumu", "success");
                await refresh();
                await loadAvailableSongs();
            } catch (e) {
                showToast(e?.message || "Nie udało się usunąć z albumu", "error");
            } finally {
                setTracksBusy(false);
            }
        },
        [token, id, showToast, refresh, loadAvailableSongs]
    );

    if (loading) return <div style={styles.page}>Ładowanie…</div>;
    if (msg) return <div style={styles.page}>{msg}</div>;

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

            {/* MODAL: SONG MENU (album) */}
            <SongActionsModal
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                songTitle={activeSong?.title}
                canRemoveFromCurrent={false}
                busy={menuBusy}
                onAddToPlaylist={() => {
                    setMenuOpen(false);
                    setAddOpen(true);
                }}
                onRemoveFromCurrent={null}
                onAddToQueue={handleAddToQueue}
                onPlayNext={handlePlayNext}
            />

            {/* MODAL: ADD TO PLAYLIST */}
            <AddToPlaylistModal
                open={addOpen}
                onClose={() => setAddOpen(false)}
                songID={activeSong?.songID}
                songTitle={activeSong?.title}
                onToast={showToast}
            />

            {/* MODAL: REPORT ALBUM */}
            {reportOpen ? (
                <div
                    style={styles.modalOverlay}
                    onMouseDown={() => {
                        if (!reportBusy) setReportOpen(false);
                    }}
                    role="dialog"
                    aria-modal="true"
                >
                    <div style={styles.modalCard} onMouseDown={(e) => e.stopPropagation()}>
                        <div style={styles.modalTitle}>Zgłoś album</div>

                        <div style={styles.modalHint}>
                            Opisz krótko powód zgłoszenia (max 255 znaków).
                        </div>

                        <textarea
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value.slice(0, 255))}
                            placeholder="Np. spam, obraźliwe treści, podszywanie się…"
                            style={styles.textareaSmall}
                            disabled={reportBusy}
                        />

                        <div style={styles.modalFooterRow}>
                            <div style={styles.counter}>{reportReason.length}/255</div>

                            <div style={{ display: "flex", gap: 10 }}>
                                <button
                                    type="button"
                                    onClick={() => setReportOpen(false)}
                                    style={styles.ghostBtn}
                                    disabled={reportBusy}
                                >
                                    Anuluj
                                </button>

                                <button
                                    type="button"
                                    onClick={submitReport}
                                    disabled={reportBusy}
                                    style={{
                                        ...styles.reportBtn,
                                        opacity: reportBusy ? 0.65 : 1,
                                        cursor: reportBusy ? "not-allowed" : "pointer",
                                    }}
                                >
                                    <Flag size={16} style={{ display: "block" }} />
                                    {reportBusy ? "Wysyłanie…" : "Wyślij zgłoszenie"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* HEADER */}
            <div style={styles.header}>
                <div style={styles.coverWrap}>
                    {albumCover ? <img src={albumCover} alt="cover" style={styles.coverImg} /> : (
                        <div style={styles.coverFallback}>
                            <Music2 size={42} style={{ opacity: 0.9 }} />
                        </div>
                    )}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={styles.kicker}>ALBUM</div>
                    <h2 style={styles.h2} title={album?.albumName || "Album"}>
                        {album?.albumName || "Album"}
                    </h2>

                    {album?.description ? (
                        <div style={styles.desc}>
                            {album.description}
                        </div>
                    ) : null}

                    <div style={styles.metaLine}>
                        {albumArtist ? <span>{albumArtist}</span> : <span style={{ opacity: 0.65 }}>—</span>}

                        {releaseDateLabel ? (
                            <>
                                <span style={{ opacity: 0.65 }}> • </span>
                                <span style={{ opacity: 0.85 }}>{releaseDateLabel}</span>
                            </>
                        ) : null}

                        <span style={{ opacity: 0.65 }}> • </span>
                        <span style={{ opacity: 0.85 }}>{sortedSongs.length} utworów</span>

                        <span style={{ opacity: 0.65 }}> • </span>
                        <span style={{ opacity: 0.85 }}>{formatTotalDuration(totalDuration)}</span>
                    </div>

                    <div style={styles.actions}>
                        <button
                            type="button"
                            onClick={playAlbum}
                            disabled={!queueItems.length}
                            style={{
                                ...styles.primaryBtn,
                                opacity: queueItems.length ? 1 : 0.6,
                                cursor: queueItems.length ? "pointer" : "not-allowed",
                            }}
                            title="Odtwórz album"
                        >
                            <Play size={16} style={{ display: "block" }} /> Odtwórz
                        </button>

                        <button
                            type="button"
                            onClick={toggleLibrary}
                            disabled={savingLibrary}
                            style={{
                                ...styles.ghostBtn,
                                opacity: savingLibrary ? 0.6 : 1,
                                cursor: savingLibrary ? "not-allowed" : "pointer",
                            }}
                            title={isInLibrary ? "Usuń z biblioteki" : "Dodaj do biblioteki"}
                        >
                            {isInLibrary ? (
                                <>
                                    <Trash2 size={16} style={{ display: "block" }} /> Usuń z biblioteki
                                </>
                            ) : (
                                <>
                                    <Plus size={16} style={{ display: "block" }} /> Dodaj do biblioteki
                                </>
                            )}
                        </button>

                        {/* REPORT (tylko nie-właściciel) */}
                        {!isOwner ? (
                            <button
                                type="button"
                                onClick={() => setReportOpen(true)}
                                disabled={!album}
                                style={{
                                    ...styles.reportBtn,
                                    opacity: !album ? 0.6 : 1,
                                    cursor: !album ? "not-allowed" : "pointer",
                                }}
                                title="Zgłoś album"
                            >
                                <Flag size={16} style={{ display: "block" }} />
                                Zgłoś
                            </button>
                        ) : null}

                        {/* OWNER PANEL */}
                        {isOwner ? (
                            <>
                                <button type="button" onClick={openEditAlbum} style={styles.ownerBtn} title="Edytuj album">
                                    <Pencil size={16} style={{ display: "block" }} /> Edytuj
                                </button>

                                <button type="button" onClick={openManageTracks} style={styles.ownerBtn} title="Zarządzaj utworami">
                                    <Music2 size={16} style={{ display: "block" }} /> Utwory
                                </button>

                                <button
                                    type="button"
                                    onClick={deleteAlbum}
                                    style={styles.dangerBtn}
                                    title="Usuń album"
                                >
                                    <Trash2 size={16} style={{ display: "block" }} /> Usuń
                                </button>

                                <button
                                    type="button"
                                    onClick={deleteCover}
                                    disabled={!albumCover}
                                    style={{
                                        ...styles.ghostBtn,
                                        opacity: albumCover ? 1 : 0.55,
                                        cursor: albumCover ? "pointer" : "not-allowed",
                                    }}
                                    title={albumCover ? "Usuń okładkę" : "Album nie ma okładki"}
                                >
                                    <Trash2 size={16} style={{ display: "block" }} /> Usuń okładkę
                                </button>

                                {/* REORDER MODE - tylko raz */}
                                {!reorderMode ? (
                                    <button
                                        type="button"
                                        onClick={beginReorder}
                                        style={styles.ghostBtn}
                                        title="Zmień kolejność utworów"
                                    >
                                        Zmień kolejność
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={cancelReorder}
                                            disabled={reorderBusy}
                                            style={{
                                                ...styles.ghostBtn,
                                                opacity: reorderBusy ? 0.6 : 1,
                                                cursor: reorderBusy ? "not-allowed" : "pointer",
                                            }}
                                            title="Anuluj"
                                        >
                                            <X size={16} style={{ display: "block" }} /> Anuluj
                                        </button>

                                        <button
                                            type="button"
                                            onClick={saveReorder}
                                            disabled={reorderBusy}
                                            style={{
                                                ...styles.primaryBtn,
                                                opacity: reorderBusy ? 0.6 : 1,
                                                cursor: reorderBusy ? "not-allowed" : "pointer",
                                            }}
                                            title="Zapisz kolejność"
                                        >
                                            <Save size={16} style={{ display: "block" }} /> {reorderBusy ? "Zapisywanie…" : "Zapisz kolejność"}
                                        </button>
                                    </>
                                )}
                            </>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* TRACKLIST */}
            <div style={styles.list}>
                {shownSongs.map((s, idx) => {
                    const queueIdx = queueIndexBySongId.get(String(s.songID));
                    const playable = !!s?.signedAudio;

                    const hidden = !!s?.isHidden || s?.moderationStatus === "HIDDEN";

                    const menuDisabled = reorderMode || hidden;

                    const disabledRow = hidden;
                    const rowStyle = disabledRow
                        ? { ...styles.row, ...(styles.rowDisabled || {}), opacity: 0.55 }
                        : styles.row;

                    return (
                        <div key={s.songID || idx} style={rowStyle}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (reorderMode) return;
                                    if (!playable) return;
                                    setNewQueue(queueItems, queueIdx ?? 0);
                                }}
                                disabled={!playable || reorderMode}
                                style={{
                                    ...styles.rowPlayBtn,
                                    opacity: playable && !reorderMode ? 1 : 0.45,
                                    cursor: playable && !reorderMode ? "pointer" : "not-allowed",
                                }}
                                title={
                                    reorderMode
                                        ? "Tryb zmiany kolejności"
                                        : playable
                                            ? "Odtwórz od tego"
                                            : hidden
                                                ? "Utwór ukryty przez administrację"
                                                : "Utwór niedostępny"
                                }
                            >
                                ▶
                            </button>

                            <div style={styles.trackNo}>
                                {(reorderMode ? idx + 1 : s.trackNumber ?? idx + 1)}.
                            </div>

                            <div style={styles.trackMain}>
                                <div style={styles.trackTitle} title={s.songName || "Utwór"}>
                                    {s.songName || "Utwór"}
                                    {hidden ? (
                                        <span style={{ opacity: 0.75, marginLeft: 8, fontSize: 12 }}>
                                (niedostępny)
                            </span>
                                    ) : null}
                                </div>

                                <div style={styles.trackSub} title={albumArtist || "—"}>
                                    {albumArtist || "—"}
                                </div>
                            </div>

                            {/* REORDER BUTTONS */}
                            {reorderMode ? (
                                <div style={styles.reorderBtns}>
                                    <button
                                        type="button"
                                        onClick={() => moveDraft(idx, idx - 1)}
                                        disabled={reorderBusy || idx === 0}
                                        style={{
                                            ...styles.reorderBtn,
                                            opacity: idx === 0 ? 0.4 : 1,
                                            cursor: idx === 0 ? "not-allowed" : "pointer",
                                        }}
                                        title="W górę"
                                    >
                                        <ArrowUp size={16} style={{ display: "block" }} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => moveDraft(idx, idx + 1)}
                                        disabled={reorderBusy || idx === shownSongs.length - 1}
                                        style={{
                                            ...styles.reorderBtn,
                                            opacity: idx === shownSongs.length - 1 ? 0.4 : 1,
                                            cursor: idx === shownSongs.length - 1 ? "not-allowed" : "pointer",
                                        }}
                                        title="W dół"
                                    >
                                        <ArrowDown size={16} style={{ display: "block" }} />
                                    </button>
                                </div>
                            ) : (
                                <div style={{ opacity: hidden ? 0.45 : 1, pointerEvents: hidden ? "none" : "auto" }}>
                                    <LikeButton songID={s.songID} onToast={showToast} />
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => openSongMenu(s.songID, s.songName || "Utwór")}
                                style={{
                                    ...styles.moreBtn,
                                    opacity: menuDisabled ? 0.45 : 1,
                                    cursor: menuDisabled ? "not-allowed" : "pointer",
                                    pointerEvents: menuDisabled ? "none" : "auto",
                                }}
                                disabled={menuDisabled}
                                title={hidden ? "Utwór ukryty" : "Opcje"}
                            >
                                ⋯
                            </button>

                            <div style={styles.trackTime}>{formatTrackDuration(s.duration)}</div>
                        </div>
                    );
                })}
            </div>

            {/* EDIT ALBUM MODAL */}
            {editAlbumOpen ? (
                <div style={styles.modalOverlay} role="dialog" aria-modal="true">
                    <div style={styles.modal}>
                        <div style={styles.modalHeader}>
                            <div style={{ fontWeight: 900 }}>Edytuj album</div>
                            <button type="button" onClick={closeEditAlbum} style={styles.iconX} title="Zamknij" disabled={editBusy}>
                                <X size={18} style={{ display: "block" }} />
                            </button>
                        </div>

                        <div style={styles.modalBody}>
                            <div style={styles.field}>
                                <div style={styles.label}>Nazwa</div>
                                <input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    disabled={editBusy}
                                    style={styles.textInput}
                                    placeholder="Nazwa albumu…"
                                />
                            </div>

                            <div style={styles.field}>
                                <div style={styles.label}>Okładka (opcjonalnie)</div>
                                <div style={styles.coverPickRow}>
                                    <div style={styles.coverPreview}>
                                        {editCoverPreview ? (
                                            <img src={editCoverPreview} alt="" style={styles.coverPreviewImg} />
                                        ) : albumCover ? (
                                            <img src={albumCover} alt="" style={styles.coverPreviewImg} />
                                        ) : (
                                            <div style={styles.coverPreviewPh}>
                                                <ImageIcon size={18} style={{ opacity: 0.75 }} />
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <input
                                            ref={editCoverRef}
                                            type="file"
                                            accept="image/png,image/jpeg,image/jpg"
                                            onChange={(e) => setEditCoverFile(e.target.files?.[0] || null)}
                                            disabled={editBusy}
                                            style={styles.fileInput}
                                        />
                                        {editCoverFile ? (
                                            <div style={styles.smallHint} title={editCoverFile.name}>
                                                Wybrano: <b>{editCoverFile.name}</b>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            <div style={styles.field}>
                                <div style={styles.label}>Data publikacji (opcjonalnie)</div>
                                <input
                                    type="date"
                                    value={editReleaseDate}
                                    onChange={(e) => setEditReleaseDate(e.target.value)}
                                    disabled={editBusy}
                                    style={styles.textInput}
                                />
                                <div style={styles.smallHint}>
                                    Jeśli data jest w przyszłości, album będzie widoczny tylko dla Ciebie.
                                </div>
                            </div>

                            <div style={styles.field}>
                                <div style={styles.label}>Opis (opcjonalnie)</div>
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    maxLength={4000}
                                    placeholder="Opis albumu, kontekst, historia powstania…"
                                    style={styles.textarea}
                                    disabled={editBusy}
                                />
                                <div style={styles.smallHint}>{String(editDescription || "").length}/4000</div>
                            </div>
                        </div>

                        <div style={styles.modalFooter}>
                            <button type="button" onClick={closeEditAlbum} style={styles.ghostBtn} disabled={editBusy}>
                                Anuluj
                            </button>

                            <button
                                type="button"
                                onClick={saveAlbumEdit}
                                disabled={editBusy}
                                style={{
                                    ...styles.primaryBtn,
                                    opacity: editBusy ? 0.65 : 1,
                                    cursor: editBusy ? "not-allowed" : "pointer",
                                }}
                                title="Zapisz"
                            >
                                <Save size={16} style={{ display: "block" }} />
                                {editBusy ? "Zapisywanie…" : "Zapisz"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* MANAGE TRACKS MODAL */}
            {manageTracksOpen ? (
                <div style={styles.modalOverlay} role="dialog" aria-modal="true">
                    <div style={styles.modal}>
                        <div style={styles.modalHeader}>
                            <div style={{ fontWeight: 900 }}>Zarządzaj utworami</div>
                            <button type="button" onClick={closeManageTracks} style={styles.iconX} title="Zamknij" disabled={tracksBusy}>
                                <X size={18} style={{ display: "block" }} />
                            </button>
                        </div>

                        <div style={styles.modalBody}>
                            {/* CURRENT TRACKS */}
                            <div style={styles.sectionTitle}>Utwory w albumie</div>

                            {!sortedSongs.length ? (
                                <div style={styles.smallHint}>Ten album nie ma jeszcze utworów.</div>
                            ) : (
                                <div style={styles.tracksBox}>
                                    {sortedSongs.map((s, idx) => {
                                        const t = pickSongTitle(s);
                                        const dur = pickDuration(s?.duration);

                                        return (
                                            <div key={s.songID || idx} style={styles.trackRow}>
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={styles.trackRowTitle} title={t}>
                                                        {s.trackNumber ?? idx + 1}. {t}
                                                    </div>
                                                    <div style={styles.trackRowSub}>{dur}</div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => removeFromAlbum(s.songID)}
                                                    disabled={tracksBusy}
                                                    style={{
                                                        ...styles.smallDangerBtn,
                                                        opacity: tracksBusy ? 0.6 : 1,
                                                        cursor: tracksBusy ? "not-allowed" : "pointer",
                                                    }}
                                                    title="Usuń z albumu"
                                                >
                                                    <Trash2 size={16} style={{ display: "block" }} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* AVAILABLE SONGS */}
                            <div style={{ height: 8 }} />

                            <div style={styles.sectionTitle}>Dodaj utwory (wolne)</div>

                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                disabled={tracksBusy}
                                style={styles.textInput}
                                placeholder="Szukaj utworu…"
                            />

                            {availableLoading ? (
                                <div style={styles.smallHint}>Ładowanie utworów…</div>
                            ) : filteredAvailable.length === 0 ? (
                                <div style={styles.smallHint}>
                                    Brak wolnych utworów do dodania (wszystkie są już w albumach lub nie masz utworów).
                                </div>
                            ) : (
                                <div style={styles.pickList}>
                                    {filteredAvailable.map((s) => {
                                        const sid = String(s?.songID ?? s?.id ?? "");
                                        const checked = pick.has(sid);

                                        return (
                                            <label key={sid} style={styles.pickRow}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => togglePick(sid)}
                                                    disabled={tracksBusy}
                                                    style={{ transform: "scale(1.05)" }}
                                                />
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={styles.pickTitle} title={pickSongTitle(s)}>
                                                        {pickSongTitle(s)}
                                                    </div>
                                                    <div style={styles.pickSub}>{pickDuration(s?.duration)}</div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div style={styles.modalFooter}>
                            <button type="button" onClick={closeManageTracks} style={styles.ghostBtn} disabled={tracksBusy}>
                                Zamknij
                            </button>

                            <button
                                type="button"
                                onClick={addPickedToAlbum}
                                disabled={tracksBusy || pick.size === 0}
                                style={{
                                    ...styles.primaryBtn,
                                    opacity: tracksBusy || pick.size === 0 ? 0.6 : 1,
                                    cursor: tracksBusy || pick.size === 0 ? "not-allowed" : "pointer",
                                }}
                                title="Dodaj zaznaczone"
                            >
                                <Plus size={16} style={{ display: "block" }} />
                                Dodaj ({pick.size})
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

const styles = {
    page: { padding: 20, color: "white", paddingBottom: 120 },

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

    header: { display: "flex", gap: 16, alignItems: "flex-start" },

    coverWrap: {
        width: 140,
        height: 140,
        borderRadius: 12,
        overflow: "hidden",
        background: "#2a2a2a",
        flex: "0 0 auto",
        border: "1px solid #2a2a2a",
    },
    coverImg: { width: "100%", height: "100%", objectFit: "cover" },
    coverFallback: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1a1a1a",
    },

    kicker: { opacity: 0.7, fontSize: 12, letterSpacing: 1, fontWeight: 900 },
    h2: { margin: "6px 0 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    desc: {
        marginTop: 8,
        maxWidth: 900,
        opacity: 0.9,
        lineHeight: 1.55,
        whiteSpace: "pre-wrap",
    },

    metaLine: { opacity: 0.85, fontSize: 13, marginTop: 8 },

    actions: { marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },

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
        cursor: "pointer",
    },

    ghostBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #333",
        background: "transparent",
        color: "white",
        fontWeight: 800,
        cursor: "pointer",
    },

    ownerBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "#161616",
        color: "white",
        fontWeight: 900,
        cursor: "pointer",
    },

    dangerBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #7a2a2a",
        background: "transparent",
        color: "#ffb4b4",
        fontWeight: 900,
        cursor: "pointer",
    },

    list: { marginTop: 18 },

    row: {
        display: "grid",
        gridTemplateColumns: "44px 40px minmax(0, 1fr) 44px 44px 60px",
        gap: 12,
        alignItems: "center",
        padding: "10px 8px",
        borderBottom: "1px solid #2a2a2a",
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
        cursor: "pointer",
    },

    moreBtn: {
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
        fontWeight: 900,
        fontSize: 18,
        lineHeight: 1,
        cursor: "pointer",
    },

    trackNo: { opacity: 0.7, textAlign: "right" },

    trackMain: { minWidth: 0 },
    trackTitle: { fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    trackSub: { fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    trackTime: { opacity: 0.75, fontSize: 12, textAlign: "right" },

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
        width: "min(820px, 100%)",
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

    modalBody: {
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 14,
    },

    field: { display: "flex", flexDirection: "column", gap: 8 },
    label: { fontSize: 12, opacity: 0.7, fontWeight: 800, letterSpacing: 0.6 },

    fileInput: {
        width: "100%",
        borderRadius: 12,
        border: "1px solid #333",
        background: "#141414",
        color: "white",
        padding: "10px 12px",
        outline: "none",
    },

    textInput: {
        width: "100%",
        borderRadius: 12,
        border: "1px solid #333",
        background: "#141414",
        color: "white",
        padding: "10px 12px",
        outline: "none",
    },

    textarea: {
        minHeight: 140,
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

    coverPickRow: { display: "flex", gap: 12, alignItems: "center" },
    coverPreview: {
        width: 56,
        height: 56,
        borderRadius: 14,
        overflow: "hidden",
        background: "#2a2a2a",
        border: "1px solid #2a2a2a",
        flex: "0 0 auto",
    },
    coverPreviewImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
    coverPreviewPh: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#202020",
    },

    smallHint: { fontSize: 12, opacity: 0.75 },

    modalFooter: {
        padding: 14,
        borderTop: "1px solid #2a2a2a",
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
    },

    sectionTitle: { fontWeight: 900, fontSize: 13, opacity: 0.85, letterSpacing: 0.4 },
    tracksBox: {
        border: "1px solid #2a2a2a",
        borderRadius: 12,
        background: "#141414",
        overflow: "hidden",
    },
    trackRow: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderBottom: "1px solid #232323",
    },
    trackRowTitle: { fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    trackRowSub: { fontSize: 12, opacity: 0.7 },

    smallDangerBtn: {
        width: 40,
        height: 36,
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "transparent",
        color: "#ffb4b4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    pickList: {
        border: "1px solid #2a2a2a",
        borderRadius: 12,
        background: "#141414",
        overflow: "hidden",
        maxHeight: 260,
        overflowY: "auto",
    },
    pickRow: {
        display: "flex",
        gap: 10,
        alignItems: "center",
        padding: "10px 12px",
        borderBottom: "1px solid #232323",
        cursor: "pointer",
        userSelect: "none",
    },
    pickTitle: { fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    pickSub: { fontSize: 12, opacity: 0.7 },

    reorderBtns: {
        display: "flex",
        gap: 8,
        justifyContent: "flex-end",
    },

    reorderBtn: {
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
    },

    reportBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #5a2a2a",
        background: "#2a1a1a",
        color: "#ffb4b4",
        fontWeight: 900,
    },

    modalCard: {
        width: "min(560px, 100%)",
        background: "#1e1e1e",
        border: "1px solid #2a2a2a",
        borderRadius: 14,
        padding: 14,
        boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
    },

    modalTitle: { fontWeight: 900, fontSize: 16, marginBottom: 10 },

    modalHint: { opacity: 0.85, fontSize: 13, marginBottom: 10 },

    textareaSmall: {
        width: "100%",
        minHeight: 110,
        resize: "vertical",
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "#121212",
        color: "white",
        padding: 12,
        outline: "none",
        fontSize: 13,
        boxSizing: "border-box",
    },

    modalFooterRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginTop: 12,
        flexWrap: "wrap",
    },

    rowDisabled: {
        opacity: 0.55,
        filter: "grayscale(0.25)",
    },

    trackTitleRow: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0,
    },

    badgeHidden: {
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: 0.8,
        opacity: 0.85,
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid #333",
        background: "#151515",
        flex: "0 0 auto",
    },

    counter: { opacity: 0.7, fontSize: 12 },
};