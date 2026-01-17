import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, Play, Flag, ListMusic } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { useLibrary } from "../../contexts/LibraryContext";
import { mapSongToPlayerItem } from "../../utils/playerAdapter";
import {addSongToQueue} from "../../api/playback/queue.api.js";

import LikeButton from "../../components/social/LikeButton.jsx";
import AddToPlaylistModal from "../../components/playlists/AddToPlaylistModal.jsx";
import SongActionsModal from "../../components/actions/SongActionsModal.jsx";
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

function formatDateTime(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;

    return d.toLocaleString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function pickSongCover(song) {
    return (
        // song?.album?.signedCover ||
        // song?.album?.coverURL ||
        song?.signedCover ||
        song?.coverURL ||
        null
    );
}

export default function PlaylistPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const { setNewQueue } = usePlayer();
    const { playlists: libraryPlaylists, togglePlaylistInLibrary, refetch } = useLibrary();
    const { refetchServerQueue } = usePlayer();

    const [playlist, setPlaylist] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");

    const [descEdit, setDescEdit] = useState(false);
    const [descDraft, setDescDraft] = useState("");
    const [descBusy, setDescBusy] = useState(false);

    const [savingLibrary, setSavingLibrary] = useState(false);
    const [toast, setToast] = useState(null);

    // modale / menu
    const [addOpen, setAddOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeSong, setActiveSong] = useState(null); // { songID, title }
    const [menuBusy, setMenuBusy] = useState(false);

    // report playlist
    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState("");
    const [reportBusy, setReportBusy] = useState(false);

    // collaborative
    const [inviteOpen, setInviteOpen] = useState(false);
    const [collabBusy, setCollabBusy] = useState(false);
    const [collabUiBusy, setCollabUiBusy] = useState(false);
    const [collabList, setCollabList] = useState([]);
    const [myCollabStatus, setMyCollabStatus] = useState("NONE"); // NONE | INVITED | ACCEPTED | OWNER
    const [inviteName, setInviteName] = useState("");

    // cover + visibility
    const coverInputRef = useRef(null);
    const [coverBusy, setCoverBusy] = useState(false);
    const [visBusy, setVisBusy] = useState(false);

    // reorder
    const [reorderMode, setReorderMode] = useState(false);
    const [orderDraft, setOrderDraft] = useState([]); // songIDs
    const [reorderBusy, setReorderBusy] = useState(false);

    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1400);
    }, []);

    const fetchPlaylistOnly = useCallback(async () => {
        if (!token) return null;
        const data = await apiFetch(`/playlists/${id}`, { token });
        return data;
    }, [id, token]);

    const fetchSongsOnly = useCallback(async () => {
        if (!token) return [];
        const data = await apiFetch(`/playlists/${id}/songs`, { token });
        return Array.isArray(data) ? data : [];
    }, [id, token]);

    useEffect(() => {
        if (!token) return;

        let alive = true;

        (async () => {
            setLoading(true);
            setMsg("");
            try {
                const [p, s] = await Promise.all([fetchPlaylistOnly(), fetchSongsOnly()]);
                if (!alive) return;
                setPlaylist(p);
                setItems(Array.isArray(s) ? s : []);
            } catch (e) {
                if (!alive) return;
                setMsg(e?.message || "Error");
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [token, fetchPlaylistOnly, fetchSongsOnly]);

    const meId = useMemo(() => String(user?.userID ?? user?.id ?? ""), [user]);
    const playlistOwnerId = useMemo(() => String(playlist?.userID ?? ""), [playlist]);

    const isOwner = useMemo(() => {
        if (!meId || !playlistOwnerId) return false;
        return meId === playlistOwnerId;
    }, [meId, playlistOwnerId]);

    // fetch collab status/list
    useEffect(() => {
        if (!token || !playlist?.playlistID) return;

        let alive = true;

        (async () => {
            try {
                const me = await apiFetch(`/playlists/${playlist.playlistID}/collaborators/me`, { token });
                if (!alive) return;
                setMyCollabStatus(me?.status || "NONE");

                if (isOwner) {
                    const list = await apiFetch(`/playlists/${playlist.playlistID}/collaborators`, { token });
                    if (!alive) return;
                    setCollabList(Array.isArray(list) ? list : []);
                } else {
                    setCollabList([]);
                }
            } catch {
                if (!alive) return;
            }
        })();

        return () => {
            alive = false;
        };
    }, [token, playlist?.playlistID, isOwner]);

    const canEdit = useMemo(() => {
        if (!playlist) return false;
        if (isOwner) return true;
        return myCollabStatus === "ACCEPTED";
    }, [playlist, isOwner, myCollabStatus]);

    // NEW: description handlers (owner OR accepted collab)
    const startEditDesc = useCallback(() => {
        if (!canEdit) return;
        setDescDraft(playlist?.description || "");
        setDescEdit(true);
    }, [canEdit, playlist?.description]);

    const cancelEditDesc = useCallback(() => {
        setDescDraft(playlist?.description || "");
        setDescEdit(false);
    }, [playlist?.description]);

    const saveDesc = useCallback(async () => {
        if (!token || !playlist?.playlistID) return;
        if (!canEdit) return;

        const trimmed = String(descDraft || "").trim();

        if (trimmed.length > 1000) {
            showToast("Opis jest za długi (max 1000 znaków).", "error");
            return;
        }

        setDescBusy(true);
        try {
            const resp = await apiFetch(`/playlists/${playlist.playlistID}`, {
                token,
                method: "PATCH",
                body: { description: trimmed },
            });

            const updated = resp?.playlist;

            // backend zwraca { message, playlist }, więc ustawiamy pewnie
            setPlaylist((prev) => (prev ? { ...prev, description: updated?.description ?? trimmed } : prev));
            setDescDraft(updated?.description ?? trimmed);

            setDescEdit(false);
            showToast("Zapisano opis", "success");
        } catch (e) {
            showToast(e?.message || "Nie udało się zapisać opisu", "error");
        } finally {
            setDescBusy(false);
        }
    }, [token, playlist?.playlistID, canEdit, descDraft, showToast]);

    const isInLibrary = useMemo(() => {
        return (libraryPlaylists || []).some((p) => String(p.playlistID) === String(id));
    }, [libraryPlaylists, id]);

    const playlistCover = playlist?.signedCover || null;
    const playlistOwner = playlist?.user?.userName || playlist?.creatorName || null;
    const createdAtLabel = useMemo(() => formatFullDate(playlist?.createdAt), [playlist?.createdAt]);

    const sortedItems = useMemo(() => {
        return (items || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    }, [items]);

    // map songID -> row (do reorder)
    const rowBySongId = useMemo(() => {
        const m = new Map();
        sortedItems.forEach((r) => m.set(String(r.songID), r));
        return m;
    }, [sortedItems]);

    const displayRows = useMemo(() => {
        if (!reorderMode) return sortedItems;
        return orderDraft.map((sid) => rowBySongId.get(String(sid))).filter(Boolean);
    }, [reorderMode, orderDraft, rowBySongId, sortedItems]);

    const queueItems = useMemo(() => {
        return (sortedItems || [])
            .map((row) => {
                const s = row.song || {};
                const mapped = mapSongToPlayerItem(s);

                const isHidden = !!s?.isHidden || s?.moderationStatus === "HIDDEN";

                return {
                    ...mapped,
                    type: "song",
                    signedCover: mapped.signedCover,

                    creatorName:
                        s.creatorName ||
                        s?.creator?.user?.userName ||
                        playlistOwner ||
                        mapped.creatorName ||
                        mapped.artistName ||
                        null,

                    songName: s.songName ?? mapped.title,
                    songID: s.songID ?? mapped.songID,
                    duration: s.duration ?? mapped.duration,
                    isHidden,
                    moderationStatus: s?.moderationStatus,
                };
            })
            .filter((x) => !!x.signedAudio && !x.isHidden);
    }, [sortedItems, playlistOwner]);

    const queueIndexBySongId = useMemo(() => {
        const m = new Map();
        queueItems.forEach((q, i) => m.set(String(q.songID), i));
        return m;
    }, [queueItems]);

    const totalDuration = useMemo(() => {
        return sortedItems.reduce((acc, row) => {
            const d = Number(row?.song?.duration);
            return acc + (Number.isFinite(d) ? d : 0);
        }, 0);
    }, [sortedItems]);

    const playPlaylist = useCallback(() => {
        if (!queueItems.length) return;
        setNewQueue(queueItems, 0);
    }, [queueItems, setNewQueue]);

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

    const toggleLibraryOrDeletePlaylist = useCallback(async () => {
        if (!token) return;

        if (isOwner) {
            const ok = window.confirm("Na pewno usunąć playlistę? Tej operacji nie da się cofnąć.");
            if (!ok) return;

            setSavingLibrary(true);
            try {
                await apiFetch(`/playlists/${id}`, { token, method: "DELETE" });
                showToast("Usunięto playlistę", "success");
                await refetch?.();
                navigate("/", { replace: true });
            } catch (e) {
                showToast(e?.message || "Nie udało się usunąć playlisty", "error");
            } finally {
                setSavingLibrary(false);
            }
            return;
        }

        if (!togglePlaylistInLibrary) {
            showToast("Brak togglePlaylistInLibrary w LibraryContext", "error");
            return;
        }

        setSavingLibrary(true);
        try {
            const result = await togglePlaylistInLibrary(id, isInLibrary);
            if (result?.success) {
                showToast(isInLibrary ? "Usunięto z biblioteki" : "Dodano do biblioteki", "success");
            } else {
                showToast(result?.message || "Błąd biblioteki", "error");
            }
        } catch (e) {
            showToast(e?.message || "Błąd biblioteki", "error");
        } finally {
            setSavingLibrary(false);
        }
    }, [token, isOwner, id, isInLibrary, togglePlaylistInLibrary, showToast, refetch, navigate]);

    const openSongMenu = useCallback((songID, title, opts = {}) => {
        setActiveSong({ songID, title, hidden: !!opts.hidden });
        setMenuOpen(true);
    }, []);

    const removeFromThisPlaylist = useCallback(async () => {
        if (!canEdit) {
            showToast("Nie masz uprawnień do edycji tej playlisty", "error");
            return;
        }
        if (!token || !activeSong?.songID) return;

        const ok = window.confirm("Usunąć ten utwór z tej playlisty?");
        if (!ok) return;

        setMenuBusy(true);
        try {
            await apiFetch(`/playlists/${id}/songs/${activeSong.songID}`, { token, method: "DELETE" });
            showToast("Usunięto z playlisty", "success");
            setMenuOpen(false);
            const s = await fetchSongsOnly();
            setItems(s);
        } catch (e) {
            showToast(e?.message || "Nie udało się usunąć utworu", "error");
        } finally {
            setMenuBusy(false);
        }
    }, [canEdit, token, activeSong, id, showToast, fetchSongsOnly]);

    const submitReport = useCallback(async () => {
        if (!token || !playlist?.playlistID) return;

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
                body: { contentType: "playlist", contentID: Number(playlist.playlistID), reason },
            });

            showToast("Zgłoszenie wysłane", "success");
            setReportOpen(false);
            setReportReason("");
        } catch (e) {
            showToast(e?.message || "Nie udało się wysłać zgłoszenia", "error");
        } finally {
            setReportBusy(false);
        }
    }, [token, playlist?.playlistID, reportReason, showToast]);

    const isCollabOn = Boolean(playlist?.isCollaborative);

    const toggleCollaborativeMode = useCallback(async () => {
        if (!token || !playlist?.playlistID || !isOwner) return;

        const nextVal = !playlist.isCollaborative;

        setCollabBusy(true);
        try {
            await apiFetch(`/playlists/${playlist.playlistID}/collaborative`, {
                token,
                method: "PATCH",
                body: { isCollaborative: nextVal },
            });

            setPlaylist((prev) => (prev ? { ...prev, isCollaborative: nextVal } : prev));
            showToast(nextVal ? "Współtworzenie włączone" : "Współtworzenie wyłączone", "success");

            // odśwież status/listy
            try {
                const me = await apiFetch(`/playlists/${playlist.playlistID}/collaborators/me`, { token });
                setMyCollabStatus(me?.status || "NONE");
                const list = await apiFetch(`/playlists/${playlist.playlistID}/collaborators`, { token });
                setCollabList(Array.isArray(list) ? list : []);
            } catch { /* */ }
        } catch (e) {
            showToast(e?.message || "Nie udało się zmienić trybu", "error");
        } finally {
            setCollabBusy(false);
        }
    }, [token, playlist?.playlistID, playlist?.isCollaborative, isOwner, showToast]);

    const sendInvite = useCallback(async () => {
        if (!token || !playlist?.playlistID) return;
        const name = inviteName.trim();
        if (name.length < 2) {
            showToast("Podaj nazwę użytkownika", "error");
            return;
        }

        setCollabUiBusy(true);
        try {
            await apiFetch(`/playlists/${playlist.playlistID}/collaborators/invite`, {
                token,
                method: "POST",
                body: { userName: name },
            });

            showToast("Zaproszenie wysłane", "success");
            setInviteName("");

            const list = await apiFetch(`/playlists/${playlist.playlistID}/collaborators`, { token });
            setCollabList(Array.isArray(list) ? list : []);
        } catch (e) {
            showToast(e?.message || "Nie udało się wysłać zaproszenia", "error");
        } finally {
            setCollabUiBusy(false);
        }
    }, [token, playlist?.playlistID, inviteName, showToast]);

    const respondInvite = useCallback(async (action) => {
        if (!token || !playlist?.playlistID) return;

        setCollabUiBusy(true);
        try {
            await apiFetch(`/playlists/${playlist.playlistID}/collaborators/respond`, {
                token,
                method: "PATCH",
                body: { action }, // ACCEPT | DECLINE
            });

            showToast(action === "ACCEPT" ? "Zaproszenie zaakceptowane" : "Zaproszenie odrzucone", "success");

            const me = await apiFetch(`/playlists/${playlist.playlistID}/collaborators/me`, { token });
            setMyCollabStatus(me?.status || "NONE");

            const s = await fetchSongsOnly();
            setItems(s);
        } catch (e) {
            showToast(e?.message || "Nie udało się wykonać akcji", "error");
        } finally {
            setCollabUiBusy(false);
        }
    }, [token, playlist?.playlistID, showToast, fetchSongsOnly]);

    const removeCollab = useCallback(async (userID) => {
        if (!token || !playlist?.playlistID) return;

        const ok = window.confirm("Usunąć współtwórcę?");
        if (!ok) return;

        setCollabUiBusy(true);
        try {
            await apiFetch(`/playlists/${playlist.playlistID}/collaborators/${userID}`, {
                token,
                method: "DELETE",
            });

            showToast("Usunięto współtwórcę", "success");

            const list = await apiFetch(`/playlists/${playlist.playlistID}/collaborators`, { token });
            setCollabList(Array.isArray(list) ? list : []);
        } catch (e) {
            showToast(e?.message || "Nie udało się usunąć", "error");
        } finally {
            setCollabUiBusy(false);
        }
    }, [token, playlist?.playlistID, showToast]);

    // Okładka
    const uploadCover = useCallback(async (file) => {
        if (!token || !playlist?.playlistID || !file) return;

        const fd = new FormData();
        fd.append("cover", file);

        setCoverBusy(true);
        try {
            await apiFetch(`/playlists/${playlist.playlistID}/cover`, {
                token,
                method: "POST",
                body: fd,
            });

            const refreshed = await apiFetch(`/playlists/${playlist.playlistID}`, { token });
            setPlaylist(refreshed);

            showToast("Okładka zapisana", "success");
        } catch (e) {
            showToast(e?.message || "Nie udało się wgrać okładki", "error");
        } finally {
            setCoverBusy(false);
        }
    }, [token, playlist?.playlistID, showToast]);

    const deleteCover = useCallback(async () => {
        if (!token || !playlist?.playlistID) return;
        const ok = window.confirm("Usunąć okładkę playlisty?");
        if (!ok) return;

        setCoverBusy(true);
        try {
            await apiFetch(`/playlists/${playlist.playlistID}/cover`, { token, method: "DELETE" });

            const refreshed = await apiFetch(`/playlists/${playlist.playlistID}`, { token });
            setPlaylist(refreshed);

            showToast("Usunięto okładkę", "success");
        } catch (e) {
            showToast(e?.message || "Nie udało się usunąć okładki", "error");
        } finally {
            setCoverBusy(false);
        }
    }, [token, playlist?.playlistID, showToast]);

    // Widoczność
    const setVisibility = useCallback(async (next) => {
        if (!token || !playlist?.playlistID || !isOwner) return;

        setVisBusy(true);
        try {
            await apiFetch(`/playlists/${playlist.playlistID}/visibility`, {
                token,
                method: "PATCH",
                body: { visibility: next },
            });

            setPlaylist((p) => (p ? { ...p, visibility: next } : p));
            showToast(next === "P" ? "Playlista publiczna" : "Playlista prywatna", "success");
        } catch (e) {
            showToast(e?.message || "Nie udało się zmienić widoczności", "error");
        } finally {
            setVisBusy(false);
        }
    }, [token, playlist?.playlistID, isOwner, showToast]);

    // Zmiana kolejności
    const startReorder = useCallback(() => {
        setOrderDraft(sortedItems.map((r) => r.songID));
        setReorderMode(true);
    }, [sortedItems]);

    const cancelReorder = useCallback(() => {
        setReorderMode(false);
        setOrderDraft([]);
    }, []);

    const moveSong = useCallback((songID, dir) => {
        setOrderDraft((prev) => {
            const i = prev.findIndex((x) => String(x) === String(songID));
            if (i < 0) return prev;
            const j = i + dir;
            if (j < 0 || j >= prev.length) return prev;
            const copy = prev.slice();
            const tmp = copy[i];
            copy[i] = copy[j];
            copy[j] = tmp;
            return copy;
        });
    }, []);

    const saveReorder = useCallback(async () => {
        if (!token || !playlist?.playlistID) return;

        setReorderBusy(true);
        try {
            await apiFetch(`/playlists/${playlist.playlistID}/reorder`, {
                token,
                method: "PATCH",
                body: { order: orderDraft },
            });

            showToast("Zapisano kolejność", "success");
            setReorderMode(false);
            setOrderDraft([]);

            const s = await fetchSongsOnly();
            setItems(s);
        } catch (e) {
            showToast(e?.message || "Nie udało się zapisać kolejności", "error");
        } finally {
            setReorderBusy(false);
        }
    }, [token, playlist?.playlistID, orderDraft, showToast, fetchSongsOnly]);

    const menuDisabled = reorderMode;

    // Renderowanie
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

            {/* MODAL: REPORT PLAYLIST */}
            {reportOpen ? (
                <div
                    style={styles.modalOverlay}
                    onMouseDown={() => {
                        if (!reportBusy) setReportOpen(false);
                    }}
                >
                    <div style={styles.modalCard} onMouseDown={(e) => e.stopPropagation()}>
                        <div style={styles.modalTitle}>Zgłoś playlistę</div>

                        <div style={styles.modalHint}>Opisz krótko powód zgłoszenia (max 255 znaków).</div>

                        <textarea
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value.slice(0, 255))}
                            placeholder="Np. spam, obraźliwe treści, podszywanie się…"
                            style={styles.textarea}
                            disabled={reportBusy}
                        />

                        <div style={styles.modalFooter}>
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
                                    style={{
                                        ...styles.reportBtn,
                                        opacity: reportBusy ? 0.6 : 1,
                                        cursor: reportBusy ? "not-allowed" : "pointer",
                                    }}
                                    disabled={reportBusy}
                                >
                                    Wyślij zgłoszenie
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* MODAL: COLLAB / INVITE */}
            {inviteOpen ? (
                <div
                    style={styles.modalOverlay}
                    onMouseDown={() => {
                        if (!collabUiBusy && !collabBusy) setInviteOpen(false);
                    }}
                >
                    <div style={styles.modalCard} onMouseDown={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <div style={styles.modalTitle}>Współtwórcy playlisty</div>

                            {isOwner ? (
                                <button
                                    type="button"
                                    onClick={toggleCollaborativeMode}
                                    disabled={collabBusy}
                                    style={{
                                        ...styles.ghostBtn,
                                        padding: "8px 10px",
                                        opacity: collabBusy ? 0.6 : 1,
                                        cursor: collabBusy ? "not-allowed" : "pointer",
                                    }}
                                    title="Włącz/wyłącz współtworzenie"
                                >
                                    Współtworzenie:{" "}
                                    <span style={{ fontWeight: 900, color: isCollabOn ? "#1db954" : "#aaa" }}>
                                        {isCollabOn ? "ON" : "OFF"}
                                    </span>
                                </button>
                            ) : null}
                        </div>

                        {isOwner ? (
                            <>
                                <div style={styles.modalHint}>
                                    Zapraszaj użytkowników po <b>userName</b>. Edycję playlisty mają tylko osoby zaakceptowane.
                                </div>

                                {!isCollabOn ? (
                                    <div style={styles.modalHint}>Najpierw włącz współtworzenie, aby wysyłać zaproszenia.</div>
                                ) : null}

                                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                    <input
                                        value={inviteName}
                                        onChange={(e) => setInviteName(e.target.value)}
                                        placeholder="userName (np. JanKowalski)"
                                        style={styles.input}
                                        disabled={collabUiBusy || !isCollabOn}
                                    />

                                    <button
                                        type="button"
                                        style={{
                                            ...styles.primaryBtn,
                                            opacity: collabUiBusy || !isCollabOn ? 0.6 : 1,
                                            cursor: collabUiBusy || !isCollabOn ? "not-allowed" : "pointer",
                                        }}
                                        disabled={collabUiBusy || !isCollabOn}
                                        onClick={sendInvite}
                                    >
                                        Wyślij zaproszenie
                                    </button>
                                </div>

                                <div style={{ marginTop: 12 }}>
                                    <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 8 }}>Lista współtwórców</div>

                                    {collabList.length ? (
                                        <div style={{ display: "grid", gap: 8 }}>
                                            {collabList.map((c) => (
                                                <div key={`${c.userID}-${c.status}-${c.createdAt || ""}`} style={styles.collabRowItem}>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div
                                                            style={{
                                                                fontWeight: 900,
                                                                whiteSpace: "nowrap",
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                            }}
                                                        >
                                                            {c.user?.userName || `User ${c.userID}`}
                                                        </div>
                                                        <div style={{ fontSize: 12, opacity: 0.75 }}>{c.status}</div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        style={styles.smallDangerBtn}
                                                        disabled={collabUiBusy}
                                                        onClick={() => removeCollab(c.userID)}
                                                    >
                                                        Usuń
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ opacity: 0.7, fontSize: 13 }}>Brak współtwórców</div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                {myCollabStatus === "INVITED" ? (
                                    <>
                                        <div style={styles.modalHint}>Masz zaproszenie do współtworzenia tej playlisty.</div>

                                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                            <button
                                                type="button"
                                                style={styles.primaryBtn}
                                                disabled={collabUiBusy}
                                                onClick={() => respondInvite("ACCEPT")}
                                            >
                                                Akceptuj
                                            </button>
                                            <button
                                                type="button"
                                                style={styles.ghostBtn}
                                                disabled={collabUiBusy}
                                                onClick={() => respondInvite("DECLINE")}
                                            >
                                                Odrzuć
                                            </button>
                                        </div>
                                    </>
                                ) : myCollabStatus === "ACCEPTED" ? (
                                    <div style={styles.modalHint}>Jesteś zaakceptowanym współtwórcą tej playlisty.</div>
                                ) : (
                                    <div style={styles.modalHint}>Nie masz zaproszenia do współtworzenia.</div>
                                )}
                            </>
                        )}

                        <div style={{ ...styles.modalFooter, justifyContent: "flex-end" }}>
                            <button
                                type="button"
                                onClick={() => setInviteOpen(false)}
                                style={styles.ghostBtn}
                                disabled={collabUiBusy || collabBusy}
                            >
                                Zamknij
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* MODAL: SONG MENU (playlist) */}
            <SongActionsModal
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                songTitle={activeSong?.title}
                hidden={!!activeSong?.hidden}
                canRemoveFromCurrent={canEdit}
                busy={menuBusy}
                onAddToPlaylist={() => {
                    setMenuOpen(false);
                    setAddOpen(true);
                }}
                onRemoveFromCurrent={canEdit ? removeFromThisPlaylist : null}
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

            {/* hidden input for cover */}
            <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) uploadCover(f);
                }}
            />

            {/* HEADER */}
            <div style={styles.header}>
                <div style={styles.coverWrap}>
                    {playlistCover ? (
                        <img src={playlistCover} alt="cover" style={styles.coverImg} />
                    ) : (
                        <div style={styles.coverPlaceholder}>
                            <ListMusic size={46} style={{ opacity: 0.85 }} />
                        </div>
                    )}
                </div>

                <div style={{ minWidth: 0 }}>
                    <div style={styles.kicker}>PLAYLISTA</div>

                    <h2 style={styles.h2}>{playlist?.playlistName || "Playlista"}</h2>

                    <div style={styles.descBlock}>
                        <div style={styles.descHeader}>
                            <span style={styles.descLabel}>Opis</span>

                            {canEdit && !descEdit ? (
                                <button
                                    type="button"
                                    onClick={startEditDesc}
                                    style={styles.descEditBtn}
                                    disabled={reorderMode}
                                    title="Edytuj opis"
                                >
                                    Edytuj
                                </button>
                            ) : null}
                        </div>

                        {!descEdit ? (
                            <div style={styles.desc}>
                                {playlist?.description?.trim()
                                    ? playlist.description
                                    : <span style={{ opacity: 0.7 }}>Brak opisu.</span>}
                            </div>
                        ) : (
                            <div style={styles.descEditor}>
                                <textarea
                                    value={descDraft}
                                    onChange={(e) => setDescDraft(e.target.value.slice(0, 1000))}
                                    style={styles.descTextarea}
                                    placeholder="Dodaj opis playlisty…"
                                    disabled={descBusy}
                                />

                                <div style={styles.descFooter}>
                                    <div style={styles.counter}>{descDraft.length}/1000</div>

                                    <div style={{ display: "flex", gap: 10 }}>
                                        <button
                                            type="button"
                                            onClick={cancelEditDesc}
                                            style={styles.ghostBtn}
                                            disabled={descBusy}
                                        >
                                            Anuluj
                                        </button>

                                        <button
                                            type="button"
                                            onClick={saveDesc}
                                            style={{
                                                ...styles.primaryBtn,
                                                opacity: descBusy ? 0.6 : 1,
                                                cursor: descBusy ? "not-allowed" : "pointer",
                                            }}
                                            disabled={descBusy}
                                        >
                                            Zapisz opis
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={styles.metaLine}>
                        {playlistOwner ? <span>{playlistOwner}</span> : <span style={{ opacity: 0.65 }}>—</span>}

                        {createdAtLabel ? (
                            <>
                                <span style={{ opacity: 0.65 }}> • </span>
                                <span style={{ opacity: 0.85 }}>{createdAtLabel}</span>
                            </>
                        ) : null}

                        <span style={{ opacity: 0.65 }}> • </span>
                        <span style={{ opacity: 0.85 }}>{sortedItems.length} utworów</span>

                        <span style={{ opacity: 0.65 }}> • </span>
                        <span style={{ opacity: 0.85 }}>{formatTotalDuration(totalDuration)}</span>
                    </div>

                    <div style={styles.actions}>
                        <button
                            type="button"
                            onClick={playPlaylist}
                            disabled={!queueItems.length}
                            style={{
                                ...styles.primaryBtn,
                                opacity: queueItems.length ? 1 : 0.6,
                                cursor: queueItems.length ? "pointer" : "not-allowed",
                            }}
                            title="Odtwórz playlistę"
                        >
                            <Play size={16} style={{ display: "block" }} /> Odtwórz
                        </button>

                        <button
                            type="button"
                            onClick={toggleLibraryOrDeletePlaylist}
                            disabled={savingLibrary}
                            style={{
                                ...styles.ghostBtn,
                                opacity: savingLibrary ? 0.6 : 1,
                                cursor: savingLibrary ? "not-allowed" : "pointer",
                            }}
                            title={
                                isOwner
                                    ? "Usuń playlistę"
                                    : isInLibrary
                                        ? "Usuń z biblioteki"
                                        : "Dodaj do biblioteki"
                            }
                        >
                            {isOwner ? (
                                <>
                                    <Trash2 size={16} style={{ display: "block" }} /> Usuń playlistę
                                </>
                            ) : isInLibrary ? (
                                <>
                                    <Trash2 size={16} style={{ display: "block" }} /> Usuń z biblioteki
                                </>
                            ) : (
                                <>
                                    <Plus size={16} style={{ display: "block" }} /> Dodaj do biblioteki
                                </>
                            )}
                        </button>

                        {/* owner: cover upload/delete */}
                        {isOwner ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => coverInputRef.current?.click()}
                                    disabled={coverBusy}
                                    style={{ ...styles.ghostBtn, opacity: coverBusy ? 0.6 : 1 }}
                                    title="Wgraj okładkę"
                                >
                                    Okładka: wgraj
                                </button>

                                {playlistCover ? (
                                    <button
                                        type="button"
                                        onClick={deleteCover}
                                        disabled={coverBusy}
                                        style={{ ...styles.ghostBtn, opacity: coverBusy ? 0.6 : 1 }}
                                        title="Usuń okładkę"
                                    >
                                        Okładka: usuń
                                    </button>
                                ) : null}
                            </>
                        ) : null}

                        {/* owner: visibility */}
                        {isOwner ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setVisibility("P")}
                                    disabled={visBusy}
                                    style={{
                                        ...styles.ghostBtn,
                                        borderColor: playlist?.visibility === "P" ? "#1db954" : "#333",
                                        opacity: visBusy ? 0.6 : 1,
                                    }}
                                    title="Ustaw publiczną"
                                >
                                    Publiczna
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setVisibility("R")}
                                    disabled={visBusy}
                                    style={{
                                        ...styles.ghostBtn,
                                        borderColor: playlist?.visibility === "R" ? "#ffb4b4" : "#333",
                                        opacity: visBusy ? 0.6 : 1,
                                    }}
                                    title="Ustaw prywatną"
                                >
                                    Prywatna
                                </button>
                            </>
                        ) : null}

                        {/* canEdit: reorder */}
                        {canEdit ? (
                            !reorderMode ? (
                                <button type="button" onClick={startReorder} style={styles.ghostBtn} title="Zmień kolejność utworów">
                                    Zmień kolejność
                                </button>
                            ) : (
                                <>
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
                                        Zapisz kolejność
                                    </button>

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
                                        Anuluj
                                    </button>
                                </>
                            )
                        ) : null}

                        {/* collab button */}
                        {(isOwner || myCollabStatus === "INVITED" || myCollabStatus === "ACCEPTED") ? (
                            <button
                                type="button"
                                onClick={() => setInviteOpen(true)}
                                style={styles.ghostBtn}
                                title="Współtwórcy / zaproszenia"
                            >
                                Współtwórcy
                                {myCollabStatus === "INVITED" ? (
                                    <span style={{ marginLeft: 8, color: "#ffb4b4", fontWeight: 900 }}>•</span>
                                ) : null}
                            </button>
                        ) : null}

                        {/* report only for not-owner */}
                        {!isOwner ? (
                            <button
                                type="button"
                                onClick={() => setReportOpen(true)}
                                disabled={!playlist}
                                style={{
                                    ...styles.reportBtn,
                                    opacity: !playlist ? 0.6 : 1,
                                    cursor: !playlist ? "not-allowed" : "pointer",
                                }}
                                title="Zgłoś playlistę"
                            >
                                <Flag size={16} style={{ display: "block" }} /> Zgłoś
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* TRACKLIST */}
            <div style={styles.list}>
                {displayRows.map((row, idx) => {
                    const s = row.song || {};
                    const queueIdx = queueIndexBySongId.get(String(s.songID));

                    const hidden = !!s?.isHidden || s?.moderationStatus === "HIDDEN";
                    const playable = !!s?.signedAudio && !hidden;
                    const canPlayBtn = playable && queueIdx != null && !reorderMode;

                    const artist = s.creatorName || s?.creator?.user?.userName || playlistOwner || "—";
                    const addedAtLabel = formatDateTime(row?.addedAt);
                    const addedByName = row?.addedBy?.userName || null;

                    const key = `${row.playlistID}-${row.songID}-${row.position ?? idx}`;

                    const playTitle = reorderMode
                        ? "Tryb zmiany kolejności"
                        : hidden
                            ? "Utwór ukryty przez administrację"
                            : playable
                                ? "Odtwórz od tego"
                                : "Utwór niedostępny";

                    const disabledRow = hidden;
                    const rowStyle = disabledRow
                        ? { ...(typeof styles.row === "function" ? styles.row(canEdit) : styles.row), ...(styles.rowDisabled || {}), opacity: 0.55 }
                        : (typeof styles.row === "function" ? styles.row(canEdit) : styles.row);

                    return (
                        <div key={key} style={rowStyle}>
                            <div
                                title={playTitle}
                                style={{
                                    display: "inline-flex",
                                    cursor: canPlayBtn ? "pointer" : "not-allowed",
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!canPlayBtn) return;
                                        setNewQueue(queueItems, queueIdx);
                                    }}
                                    disabled={!canPlayBtn}
                                    style={{
                                        ...styles.rowPlayBtn,
                                        opacity: canPlayBtn ? 1 : 0.45,
                                        cursor: "inherit",
                                    }}
                                >
                                    ▶
                                </button>
                            </div>

                            <div style={styles.miniCoverWrap}>
                                {pickSongCover(s) ? (
                                    <img src={pickSongCover(s)} alt="" style={styles.miniCoverImg} />
                                ) : (
                                    <div style={styles.miniCoverPh} />
                                )}
                            </div>

                            <div style={styles.trackNo}>{row.position ?? idx + 1}.</div>

                            <div style={styles.trackMain}>
                                <div style={styles.trackTitle} title={s.songName || "Utwór"}>
                                    {s.songName || "Utwór"}
                                    {hidden ? (
                                        <span style={{ opacity: 0.75, marginLeft: 8, fontSize: 12 }}>
                                (niedostępny)
                            </span>
                                    ) : null}
                                </div>

                                <div style={styles.trackSub} title={artist}>
                                    {artist}
                                    {addedAtLabel ? (
                                        <span style={{ opacity: 0.65 }}>
                                {" "}• dodano {addedAtLabel}
                                            {addedByName ? ` • przez ${addedByName}` : ""}
                            </span>
                                    ) : null}
                                </div>
                            </div>

                            <div
                                style={{
                                    ...styles.likeWrap,
                                    opacity: hidden ? 0.45 : 1,
                                    pointerEvents: hidden ? "none" : "auto",
                                }}
                            >
                                <LikeButton songID={s.songID} onToast={showToast} />
                            </div>

                            {/* reorder arrows OR normal menu */}
                            {reorderMode ? (
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        justifySelf: "end",
                                        width: 44,
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => moveSong(row.songID, -1)}
                                        title="W górę"
                                        style={{
                                            ...styles.moreBtn,
                                            width: 38,
                                            height: 16,
                                            fontSize: 12,
                                            lineHeight: "16px",
                                        }}
                                    >
                                        ↑
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => moveSong(row.songID, +1)}
                                        title="W dół"
                                        style={{
                                            ...styles.moreBtn,
                                            width: 38,
                                            height: 16,
                                            fontSize: 12,
                                            lineHeight: "16px",
                                        }}
                                    >
                                        ↓
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => openSongMenu(s.songID, s.songName || "Utwór", { hidden })}
                                    style={{
                                        ...styles.moreBtn,
                                        opacity: menuDisabled ? 0.45 : 1,
                                        cursor: menuDisabled ? "not-allowed" : "pointer",
                                        pointerEvents: menuDisabled ? "none" : "auto",
                                    }}
                                    disabled={menuDisabled}
                                    title={
                                        menuDisabled
                                            ? "Tryb zmiany kolejności"
                                            : hidden
                                                ? "Utwór ukryty"
                                                : "Opcje"
                                    }
                                >
                                    ⋯
                                </button>
                            )}
                            <div style={styles.trackTime}>{formatTrackDuration(s.duration)}</div>
                        </div>
                    );
                })}
            </div>
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

    header: { display: "flex", gap: 16, alignItems: "center" },

    coverWrap: {
        width: 140,
        height: 140,
        borderRadius: 12,
        overflow: "hidden",
        background: "#2a2a2a",
        flex: "0 0 auto",
    },
    coverImg: { width: "100%", height: "100%", objectFit: "cover" },

    kicker: { opacity: 0.7, fontSize: 12, letterSpacing: 1 },
    h2: { margin: "6px 0 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    metaLine: { opacity: 0.85, fontSize: 13 },

    actions: { marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" },

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
    },

    list: { marginTop: 18 },

    row: () => ({
        display: "grid",
        gridTemplateColumns: "44px 44px 34px minmax(0, 1fr) 44px 44px 70px",
        gap: 12,
        alignItems: "center",
        padding: "10px 8px",
        borderBottom: "1px solid #2a2a2a",
    }),

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
    },

    likeWrap: {
        justifySelf: "end",
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

    modalOverlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
        padding: 16,
    },

    modalCard: {
        width: "min(560px, 100%)",
        background: "#1e1e1e",
        border: "1px solid #2a2a2a",
        borderRadius: 14,
        padding: 14,
        boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
    },

    modalTitle: {
        fontWeight: 900,
        fontSize: 16,
        marginBottom: 10,
    },

    modalHint: {
        opacity: 0.85,
        fontSize: 13,
        marginBottom: 10,
    },

    textarea: {
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

    modalFooter: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginTop: 12,
        flexWrap: "wrap",
    },

    counter: {
        opacity: 0.7,
        fontSize: 12,
    },

    collabRow: {
        marginTop: 10,
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
    },

    collabBtn: {
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid #333",
        background: "transparent",
        color: "white",
        fontWeight: 900,
    },

    inviteBox: {
        marginTop: 12,
        background: "#1e1e1e",
        border: "1px solid #2a2a2a",
        borderRadius: 12,
        padding: 12,
    },

    input: {
        height: 38,
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "#121212",
        color: "white",
        padding: "0 12px",
        outline: "none",
        minWidth: 220,
    },

    collabRowItem: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "#141414",
    },

    smallDangerBtn: {
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #5a2a2a",
        background: "#2a1a1a",
        color: "#ffb4b4",
        fontWeight: 900,
    },

    coverPlaceholder: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#2a2a2a",
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

    descBlock: {
        marginTop: 14,
        maxWidth: 900,
    },

    descHeader: {
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 6,
    },

    descLabel: {
        fontSize: 13,
        letterSpacing: 1,
        opacity: 0.6,
        fontWeight: 800,
        textTransform: "uppercase",
    },

    descEditBtn: {
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid #333",
        background: "#1e1e1e",
        color: "white",
        fontWeight: 700,
        cursor: "pointer",
    },

    desc: {
        fontSize: 14,
        lineHeight: 1.5,
        opacity: 0.95,
    },

    miniCoverImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
    miniCoverPh: { width: "100%", height: "100%", background: "#2a2a2a" },

    trackNo: { opacity: 0.7, textAlign: "right", fontVariantNumeric: "tabular-nums" },
    trackMain: { minWidth: 0, overflow: "hidden" },
    trackTitle: { fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    trackSub: {fontSize: 12, opacity: 0.7, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",},
    trackTime: { opacity: 0.75, fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" },
};