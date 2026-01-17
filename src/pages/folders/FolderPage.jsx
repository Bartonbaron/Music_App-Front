import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Folder as FolderIcon, Pencil, Trash2, X, Plus } from "lucide-react";

import { apiFetch } from "../../api/http";
import { useAuth } from "../../contexts/AuthContext";
import { useLibrary } from "../../contexts/LibraryContext";

import AddPlaylistToFolderModal from "../../components/library/AddPlaylistToFolderModal.jsx";

function pickPlaylistCover(p) {
    return p?.signedCover || p?.coverSigned || p?.signedCoverURL || p?.coverURL || null;
}

function pickPlaylistName(p) {
    return p?.playlistName || p?.name || "Playlista";
}

export default function FolderPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token } = useAuth();

    const { deleteFolder, playlists: libraryPlaylists } = useLibrary();

    const [folder, setFolder] = useState(null);
    const [rows, setRows] = useState([]); // [{ folderID, playlistID, playlist }]
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    // modal add playlist
    const [addOpen, setAddOpen] = useState(false);

    const [brokenCovers, setBrokenCovers] = useState(() => new Set());

    const load = useCallback(async () => {
        if (!token || !id) return;

        setLoading(true);
        setError("");

        try {
            const [folderRes, playlistsRes] = await Promise.all([
                apiFetch(`/folders/${id}`, { token }),
                apiFetch(`/folders/${id}/playlists`, { token }),
            ]);

            setFolder(folderRes || null);
            setRows(Array.isArray(playlistsRes) ? playlistsRes : []);
            setBrokenCovers(new Set()); // reset po reload
        } catch (e) {
            setError(e?.message || "Nie udało się pobrać folderu");
            setFolder(null);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [token, id]);

    useEffect(() => {
        load();
    }, [load]);

    const folderTitle = folder?.folderName || "Folder";

    const items = useMemo(() => {
        return (rows || []).map((r) => {
            const p = r?.playlist || null;
            const pid = p?.playlistID ?? r?.playlistID ?? null;

            return {
                key: `${r?.folderID ?? id}-${pid ?? "noid"}`,
                folderID: r?.folderID ?? Number(id),
                playlistID: pid,
                title: pickPlaylistName(p),
                cover: pickPlaylistCover(p),
                raw: r,
            };
        });
    }, [rows, id]);

    // playlisty już w folderze (żeby nie proponować ich w modalu)
    const existingPlaylistIds = useMemo(() => {
        const set = new Set();
        (rows || []).forEach((r) => {
            const pid = r?.playlist?.playlistID ?? r?.playlistID;
            if (pid != null) set.add(String(pid));
        });
        return set;
    }, [rows]);

    // opcje do modala: playlisty z biblioteki, których nie ma jeszcze w folderze
    const addOptions = useMemo(() => {
        const all = Array.isArray(libraryPlaylists) ? libraryPlaylists : [];
        return all.filter((p) => p?.playlistID != null && !existingPlaylistIds.has(String(p.playlistID)));
    }, [libraryPlaylists, existingPlaylistIds]);

    const handleRename = useCallback(async () => {
        if (!token || !id) return;

        const nextName = window.prompt("Nowa nazwa folderu:", folderTitle);
        if (!nextName) return;

        setBusy(true);
        setError("");

        try {
            await apiFetch(`/folders/${id}`, {
                token,
                method: "PATCH",
                body: { folderName: nextName },
            });
            await load();
        } catch (e) {
            setError(e?.message || "Nie udało się zmienić nazwy folderu");
        } finally {
            setBusy(false);
        }
    }, [token, id, folderTitle, load]);

    const handleDeleteFolder = useCallback(async () => {
        if (!token || !id) return;

        const ok = window.confirm("Na pewno usunąć folder? (playlisty nie zostaną usunięte)");
        if (!ok) return;

        setBusy(true);
        setError("");

        try {
            const result = await deleteFolder(id);
            if (!result?.success) throw new Error(result?.message || "Nie udało się usunąć folderu");
            navigate(-1);
        } catch (e) {
            setError(e?.message || "Nie udało się usunąć folderu");
        } finally {
            setBusy(false);
        }
    }, [token, id, deleteFolder, navigate]);

    const handleAddFromModal = useCallback(
        async (playlistID) => {
            if (!token || !id || !playlistID) return;

            const pid = Number(playlistID);
            if (!Number.isFinite(pid) || pid <= 0) throw new Error("Nieprawidłowe ID playlisty");

            await apiFetch(`/folders/${id}/playlists`, {
                token,
                method: "POST",
                body: { playlistID: pid },
            });

            await load();
        },
        [token, id, load]
    );

    const handleRemovePlaylist = useCallback(
        async (playlistID) => {
            if (!token || !id || !playlistID) return;

            setBusy(true);
            setError("");

            try {
                await apiFetch(`/folders/${id}/playlists/${playlistID}`, {
                    token,
                    method: "DELETE",
                });
                await load();
            } catch (e) {
                setError(e?.message || "Nie udało się usunąć playlisty z folderu");
            } finally {
                setBusy(false);
            }
        },
        [token, id, load]
    );

    const markBrokenCover = useCallback((playlistID) => {
        if (!playlistID) return;
        setBrokenCovers((prev) => {
            const next = new Set(prev);
            next.add(String(playlistID));
            return next;
        });
    }, []);

    if (!token) {
        return (
            <div style={styles.page}>
                <div style={{ opacity: 0.75 }}>Zaloguj się, aby zobaczyć folder.</div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            {/* MODAL: add playlist */}
            <AddPlaylistToFolderModal
                open={addOpen}
                onClose={() => setAddOpen(false)}
                folderName={folderTitle}
                options={addOptions}
                onAdd={handleAddFromModal}
                busy={busy || loading}
                onToast={(text, type) => {
                    if (type === "error") setError(text);
                }}
            />

            {/* TOP BAR */}
            <div style={styles.topBar}>
                <button type="button" onClick={() => navigate(-1)} style={styles.backBtn} title="Wstecz">
                    <ArrowLeft size={18} style={{ display: "block" }} />
                </button>

                <div style={styles.titleWrap}>
                    <div style={styles.titleRow}>
                        <FolderIcon size={16} style={{ opacity: 0.9 }} />
                        <h1 style={styles.h1} title={folderTitle}>
                            {folderTitle}
                        </h1>
                    </div>
                </div>

                <div style={styles.actions}>
                    <button
                        type="button"
                        onClick={() => setAddOpen(true)}
                        disabled={busy || loading}
                        style={{
                            ...styles.btn,
                            opacity: busy || loading ? 0.6 : 1,
                            cursor: busy || loading ? "not-allowed" : "pointer",
                        }}
                        title="Dodaj playlistę do folderu"
                    >
                        <Plus size={16} /> Dodaj
                    </button>

                    <button
                        type="button"
                        onClick={handleRename}
                        disabled={busy || loading || !folder}
                        style={{
                            ...styles.btn,
                            opacity: busy || loading || !folder ? 0.6 : 1,
                            cursor: busy || loading || !folder ? "not-allowed" : "pointer",
                        }}
                        title="Zmień nazwę folderu"
                    >
                        <Pencil size={16} /> Zmień nazwę
                    </button>

                    <button
                        type="button"
                        onClick={handleDeleteFolder}
                        disabled={busy || loading || !folder}
                        style={{
                            ...styles.btnDanger,
                            opacity: busy || loading || !folder ? 0.6 : 1,
                            cursor: busy || loading || !folder ? "not-allowed" : "pointer",
                        }}
                        title="Usuń folder"
                    >
                        <Trash2 size={16} /> Usuń
                    </button>
                </div>
            </div>

            {error ? <div style={styles.error}>{error}</div> : null}
            {loading ? <div style={{ opacity: 0.75 }}>Ładowanie…</div> : null}

            {/* LIST */}
            <div style={styles.card}>
                <div style={styles.cardHeader}>
                    <div style={styles.cardTitle}>Playlisty w folderze ({items.length})</div>
                </div>

                {items.length === 0 && !loading ? (
                    <div style={styles.hint}>Brak playlist w folderze.</div>
                ) : (
                    <div style={styles.list}>
                        {items.map((it) => {
                            const isBroken = it.playlistID != null && brokenCovers.has(String(it.playlistID));
                            const showImg = !!it.cover && !isBroken;

                            return (
                                <div key={it.key} style={styles.row}>
                                    <div style={styles.cover}>
                                        {showImg ? (
                                            <img
                                                src={it.cover}
                                                alt=""
                                                style={styles.coverImg}
                                                referrerPolicy="no-referrer"
                                                crossOrigin="anonymous"
                                                onError={() => markBrokenCover(it.playlistID)}
                                            />
                                        ) : (
                                            <div style={styles.coverPh} />
                                        )}
                                    </div>

                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={styles.rowTitle}>{it.title}</div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => it.playlistID && navigate(`/playlists/${it.playlistID}`)}
                                        disabled={!it.playlistID}
                                        style={{
                                            ...styles.openBtn,
                                            opacity: it.playlistID ? 1 : 0.5,
                                            cursor: it.playlistID ? "pointer" : "not-allowed",
                                        }}
                                        title="Otwórz playlistę"
                                    >
                                        Otwórz
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleRemovePlaylist(it.playlistID)}
                                        disabled={busy || !it.playlistID}
                                        style={{
                                            ...styles.removeBtn,
                                            opacity: busy || !it.playlistID ? 0.5 : 1,
                                            cursor: busy || !it.playlistID ? "not-allowed" : "pointer",
                                        }}
                                        title="Usuń z folderu"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

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

    topBar: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 14,
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
        cursor: "pointer",
    },

    titleWrap: { minWidth: 0, flex: 1 },
    titleRow: { display: "flex", alignItems: "center", gap: 10 },
    h1: {
        margin: 0,
        fontSize: 22,
        fontWeight: 900,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },

    actions: { display: "flex", gap: 10, flexWrap: "wrap" },

    btn: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "#1e1e1e",
        color: "white",
        fontWeight: 900,
    },

    btnDanger: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #5a2a2a",
        background: "#2a1a1a",
        color: "#ffb4b4",
        fontWeight: 900,
    },

    error: {
        background: "#2a1a1a",
        border: "1px solid #5a2a2a",
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
    },

    card: {
        background: "#1e1e1e",
        borderRadius: 14,
        border: "1px solid #2a2a2a",
        padding: 14,
    },

    cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    cardTitle: { fontWeight: 900, opacity: 0.95 },

    hint: { opacity: 0.75, fontSize: 13, padding: "8px 2px" },

    list: { display: "flex", flexDirection: "column", gap: 10 },

    row: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "#141414",
    },

    cover: {
        width: 44,
        height: 44,
        borderRadius: 12,
        overflow: "hidden",
        background: "#2a2a2a",
        border: "1px solid #2a2a2a",
        flex: "0 0 auto",
    },
    coverImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
    coverPh: { width: "100%", height: "100%", background: "#2a2a2a" },

    rowTitle: { fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    openBtn: {
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "transparent",
        color: "white",
        padding: "8px 12px",
        fontWeight: 900,
    },

    removeBtn: {
        width: 38,
        height: 34,
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "transparent",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
    },
};