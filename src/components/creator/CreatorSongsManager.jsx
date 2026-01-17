import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Upload, X, Music2, Image as ImageIcon, Pencil, Save, ExternalLink } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "../../api/http";
import { fetchGenres } from "../../api/content/genres.api.js";

function pickSongTitle(s) {
    return s?.songName || s?.title || "Utwór";
}
function pickSongCover(s) {
    return s?.signedCover || s?.coverSigned || s?.coverURL || null;
}
function pickDuration(seconds) {
    const n = Number(seconds);
    if (!Number.isFinite(n) || n <= 0) return "—";
    const m = Math.floor(n / 60);
    const s = Math.floor(n % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}
function pickGenreID(s) {
    const raw = s?.genreID ?? s?.genre?.genreID ?? null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? String(n) : "";
}

export default function CreatorSongsManager({ songs = [], onChanged }) {
    const navigate = useNavigate();
    const { token } = useAuth();

    // Toast
    const [toast, setToast] = useState(null);
    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1600);
    }, []);

    // Gatunki
    const [genres, setGenres] = useState([]);
    const [genresLoading, setGenresLoading] = useState(false);

    const loadGenres = useCallback(async () => {
        if (!token) return;
        setGenresLoading(true);
        try {
            const res = await fetchGenres(token);
            const arr = Array.isArray(res) ? res : res?.genres;
            setGenres(Array.isArray(arr) ? arr : []);
        } catch (e) {
            console.warn("GENRES LOAD ERROR:", e);
            setGenres([]);
        } finally {
            setGenresLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadGenres();
    }, [loadGenres]);

    const genresSorted = useMemo(() => {
        const arr = Array.isArray(genres) ? [...genres] : [];
        arr.sort((a, b) => String(a?.genreName || "").localeCompare(String(b?.genreName || ""), "pl"));
        return arr;
    }, [genres]);

    // ADD (upload)
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const [audioFile, setAudioFile] = useState(null);
    const [coverFile, setCoverFile] = useState(null);
    const [genreID, setGenreID] = useState("");

    const fileInputRef = useRef(null);
    const coverInputRef = useRef(null);

    const coverPreview = useMemo(() => {
        if (!coverFile) return null;
        return URL.createObjectURL(coverFile);
    }, [coverFile]);

    useEffect(() => {
        return () => {
            if (coverPreview) URL.revokeObjectURL(coverPreview);
        };
    }, [coverPreview]);

    const resetForm = useCallback(() => {
        setAudioFile(null);
        setCoverFile(null);
        setGenreID("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (coverInputRef.current) coverInputRef.current.value = "";
    }, []);

    const openModal = useCallback(() => {
        resetForm();
        setOpen(true);
    }, [resetForm]);

    const closeModal = useCallback(() => {
        if (busy) return;
        setOpen(false);
    }, [busy]);

    const uploadSong = useCallback(async () => {
        if (!token) {
            showToast("Zaloguj się ponownie", "error");
            return;
        }
        if (!audioFile) {
            showToast("Wybierz plik audio", "error");
            return;
        }
        const gid = Number(genreID);
        if (!Number.isFinite(gid) || gid <= 0) {
            showToast("Wybierz gatunek", "error");
            return;
        }

        setBusy(true);
        try {
            const fd = new FormData();
            fd.append("file", audioFile);
            if (coverFile) fd.append("cover", coverFile);
            fd.append("genreID", String(gid));

            await apiFetch("/songs/upload", {
                token,
                method: "POST",
                body: fd,
            });

            showToast("Utwór dodany", "success");
            setOpen(false);
            resetForm();
            if (typeof onChanged === "function") await onChanged();
        } catch (e) {
            showToast(e?.message || "Nie udało się dodać utworu", "error");
        } finally {
            setBusy(false);
        }
    }, [token, audioFile, coverFile, genreID, showToast, resetForm, onChanged]);


    // DELETE
    const [deletingID, setDeletingID] = useState(null);

    const deleteSong = useCallback(
        async (songID) => {
            if (!token) {
                showToast("Zaloguj się ponownie", "error");
                return;
            }
            if (!songID) return;

            const ok = window.confirm("Na pewno usunąć ten utwór? Tej operacji nie da się cofnąć.");
            if (!ok) return;

            setDeletingID(String(songID));
            try {
                await apiFetch(`/songs/${songID}`, { token, method: "DELETE" });
                showToast("Utwór usunięty", "success");
                if (typeof onChanged === "function") await onChanged();
            } catch (e) {
                showToast(e?.message || "Nie udało się usunąć utworu", "error");
            } finally {
                setDeletingID(null);
            }
        },
        [token, showToast, onChanged]
    );

    // EDIT
    const [editOpen, setEditOpen] = useState(false);
    const [editBusy, setEditBusy] = useState(false);

    const [editSongID, setEditSongID] = useState(null);
    const [editSongName, setEditSongName] = useState("");
    const [editGenreID, setEditGenreID] = useState("");
    const [editSongDescription, setEditSongDescription] = useState("");
    const [editCoverFile, setEditCoverFile] = useState(null);

    const editCoverInputRef = useRef(null);

    const editCoverPreview = useMemo(() => {
        if (!editCoverFile) return null;
        return URL.createObjectURL(editCoverFile);
    }, [editCoverFile]);

    useEffect(() => {
        return () => {
            if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
        };
    }, [editCoverPreview]);

    const openEdit = useCallback((song) => {
        const id = song?.songID ?? song?.id ?? null;
        if (!id) return;

        setEditSongID(String(id));
        setEditSongName(String(pickSongTitle(song) || ""));
        setEditGenreID(pickGenreID(song));
        setEditSongDescription(String(song?.description ?? ""));
        setEditCoverFile(null);

        if (editCoverInputRef.current) editCoverInputRef.current.value = "";
        setEditOpen(true);
    }, []);

    const closeEdit = useCallback(() => {
        if (editBusy) return;
        setEditOpen(false);
    }, [editBusy]);

    const saveEdit = useCallback(async () => {
        if (!token) {
            showToast("Zaloguj się ponownie", "error");
            return;
        }
        if (!editSongID) return;

        const nameTrim = String(editSongName || "").trim();
        if (!nameTrim) {
            showToast("Nazwa utworu nie może być pusta", "error");
            return;
        }

        const gid = Number(editGenreID);
        if (!Number.isFinite(gid) || gid <= 0) {
            showToast("Wybierz gatunek", "error");
            return;
        }

        setEditBusy(true);
        try {
            const fd = new FormData();
            fd.append("songName", nameTrim);
            fd.append("genreID", String(gid));
            fd.append("description", String(editSongDescription ?? ""));
            if (editCoverFile) fd.append("cover", editCoverFile);

            await apiFetch(`/songs/${editSongID}`, {
                token,
                method: "PATCH",
                body: fd,
            });

            showToast("Zapisano zmiany", "success");
            setEditOpen(false);
            if (typeof onChanged === "function") await onChanged();
        } catch (e) {
            showToast(e?.message || "Nie udało się zapisać zmian", "error");
        } finally {
            setEditBusy(false);
        }
    }, [token, editSongID, editSongName, editGenreID, editSongDescription, editCoverFile, showToast, onChanged]);

    return (
        <div style={styles.wrap}>
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

            {/* HEADER */}
            <div style={styles.headRow}>
                <div style={styles.headLeft}>
                    <Music2 size={16} style={{ display: "block", opacity: 0.85 }} />
                    <div style={styles.title}>Utwory</div>
                    <div style={styles.count}>{Array.isArray(songs) ? songs.length : 0}</div>
                </div>

                <button type="button" onClick={openModal} style={styles.addBtn} title="Dodaj utwór">
                    <Plus size={16} style={{ display: "block" }} />
                    Dodaj
                </button>
            </div>

            {/* LIST */}
            {!songs?.length ? (
                <div style={styles.empty}>Brak utworów.</div>
            ) : (
                <div style={styles.list}>
                    {songs.map((s) => {
                        const id = s?.songID ?? s?.id;
                        const cover = pickSongCover(s);
                        const title = pickSongTitle(s);
                        const dur = pickDuration(s?.duration);
                        const hidden = String(s?.moderationStatus || "ACTIVE").toUpperCase() === "HIDDEN";
                        const statusLabel = hidden ? "Ukryty" : null;
                        const isDel = deletingID != null && String(id) === String(deletingID);

                        return (
                            <div
                                key={id ?? title}
                                style={{
                                    ...styles.row,
                                    ...(hidden ? styles.rowDisabled : null),
                                }}
                            >
                                {/* 1. COVER */}
                                <div style={styles.cover}>
                                    {cover ? (
                                        <img
                                            src={cover}
                                            alt=""
                                            style={styles.coverImg}
                                            referrerPolicy="no-referrer"
                                            crossOrigin="anonymous"
                                        />
                                    ) : (
                                        <div style={styles.coverPh} />
                                    )}
                                </div>

                                {/* 2. TEXT CONTENT (Title + Subtitle) */}
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    {/* KLIKALNY WIERSZ TYTUŁU */}
                                    <div
                                        style={{
                                            ...styles.rowTitleLink,
                                            cursor: hidden ? "not-allowed" : "pointer",
                                            opacity: hidden ? 0.9 : 1,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            minWidth: 0,
                                        }}
                                        title={hidden ? "Utwór ukryty przez moderację" : "Przejdź do szczegółów"}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => {
                                            if (hidden) return;
                                            navigate(`/songs/${id}`);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                if (hidden) return;
                                                navigate(`/songs/${id}`);
                                            }
                                        }}
                                    >
                                    <span style={{
                                        minWidth: 0,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap"
                                    }}>
                                    {title}{" "}
                                    <ExternalLink
                                        size={14}
                                        style={{
                                            display: "inline-block",
                                            opacity: hidden ? 0.35 : 0.85
                                        }}
                                    />
                                    </span>

                                        {statusLabel ? (
                                            <span style={styles.badgePill} title="Utwór ukryty przez moderację">
                                                {statusLabel}
                                            </span>
                                        ) : null}
                                    </div>

                                    {/* PODTYTUŁ (POZA KLIKALNYM TYTUŁEM) */}
                                    <div style={styles.rowSub}>
                                        <span>{dur}</span>
                                        {s?.genre?.genreName && (
                                            <>
                                                <span style={{ opacity: 0.45 }}> • </span>
                                                <span>{s.genre.genreName}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* 3. BUTTONS */}
                                <div style={styles.rowBtns}>
                                    <button
                                        type="button"
                                        onClick={() => openEdit(s)}
                                        style={styles.editBtn}
                                        title="Edytuj"
                                    >
                                        <Pencil size={16} style={{ display: "block" }} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => deleteSong(id)}
                                        disabled={isDel}
                                        style={{
                                            ...styles.delBtn,
                                            opacity: isDel ? 0.6 : 1,
                                            cursor: isDel ? "not-allowed" : "pointer",
                                        }}
                                        title="Usuń"
                                    >
                                        <Trash2 size={16} style={{ display: "block" }} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ADD MODAL */}
            {open ? (
                <div style={styles.modalOverlay} role="dialog" aria-modal="true">
                    <div style={styles.modal}>
                        <div style={styles.modalHeader}>
                            <div style={{ fontWeight: 900 }}>Dodaj utwór</div>

                            <button type="button" onClick={closeModal} style={styles.iconX} title="Zamknij" disabled={busy}>
                                <X size={18} style={{ display: "block" }} />
                            </button>
                        </div>

                        <div style={styles.modalBody}>
                            <div style={styles.field}>
                                <div style={styles.label}>Plik audio (MP3/WAV/FLAC)</div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".mp3,.wav,.flac,audio/*"
                                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                                    disabled={busy}
                                    style={styles.fileInput}
                                />
                                {audioFile ? (
                                    <div style={styles.smallHint} title={audioFile.name}>
                                        Wybrano: <b>{audioFile.name}</b>
                                    </div>
                                ) : null}
                            </div>

                            <div style={styles.field}>
                                <div style={styles.label}>Okładka (opcjonalnie)</div>

                                <div style={styles.coverPickRow}>
                                    <div style={styles.coverPreview}>
                                        {coverPreview ? (
                                            <img src={coverPreview} alt="" style={styles.coverPreviewImg} />
                                        ) : (
                                            <div style={styles.coverPreviewPh}>
                                                <ImageIcon size={18} style={{ opacity: 0.75 }} />
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <input
                                            ref={coverInputRef}
                                            type="file"
                                            accept="image/png,image/jpeg,image/jpg"
                                            onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                                            disabled={busy}
                                            style={styles.fileInput}
                                        />
                                        {coverFile ? (
                                            <div style={styles.smallHint} title={coverFile.name}>
                                                Wybrano: <b>{coverFile.name}</b>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            <div style={styles.field}>
                                <div style={styles.label}>Gatunek</div>

                                <select value={genreID} onChange={(e) => setGenreID(e.target.value)} disabled={busy || genresLoading} style={styles.select}>
                                    <option value="" disabled>
                                        {genresLoading ? "Ładowanie gatunków…" : "Wybierz gatunek…"}
                                    </option>
                                    {genresSorted.map((g) => (
                                        <option key={g.genreID} value={g.genreID}>
                                            {g.genreName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={styles.modalFooter}>
                            <button type="button" onClick={closeModal} style={styles.ghostBtn} disabled={busy}>
                                Anuluj
                            </button>

                            <button
                                type="button"
                                onClick={uploadSong}
                                disabled={busy}
                                style={{
                                    ...styles.primaryBtn,
                                    opacity: busy ? 0.65 : 1,
                                    cursor: busy ? "not-allowed" : "pointer",
                                }}
                                title="Wyślij"
                            >
                                <Upload size={16} style={{ display: "block" }} />
                                {busy ? "Wysyłanie…" : "Dodaj"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* EDIT MODAL */}
            {editOpen ? (
                <div style={styles.modalOverlay} role="dialog" aria-modal="true">
                    <div style={styles.modal}>
                        <div style={styles.modalHeader}>
                            <div style={{ fontWeight: 900 }}>Edytuj utwór</div>

                            <button type="button" onClick={closeEdit} style={styles.iconX} title="Zamknij" disabled={editBusy}>
                                <X size={18} style={{ display: "block" }} />
                            </button>
                        </div>

                        <div style={styles.modalBody}>
                            <div style={styles.field}>
                                <div style={styles.label}>Nazwa utworu</div>
                                <input
                                    value={editSongName}
                                    onChange={(e) => setEditSongName(e.target.value)}
                                    disabled={editBusy}
                                    style={styles.textInput}
                                    placeholder="Nazwa utworu…"
                                />
                            </div>

                            <div style={styles.field}>
                                <div style={styles.label}>Okładka (opcjonalnie)</div>

                                <div style={styles.coverPickRow}>
                                    <div style={styles.coverPreview}>
                                        {editCoverPreview ? (
                                            <img src={editCoverPreview} alt="" style={styles.coverPreviewImg} />
                                        ) : (
                                            <div style={styles.coverPreviewPh}>
                                                <ImageIcon size={18} style={{ opacity: 0.75 }} />
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <input
                                            ref={editCoverInputRef}
                                            type="file"
                                            accept="image/png,image/jpeg,image/jpg"
                                            onChange={(e) => setEditCoverFile(e.target.files?.[0] || null)}
                                            disabled={editBusy}
                                            style={styles.fileInput}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div style={styles.field}>
                                <div style={styles.label}>Gatunek</div>
                                <select value={editGenreID} onChange={(e) => setEditGenreID(e.target.value)} disabled={editBusy || genresLoading} style={styles.select}>
                                    <option value="" disabled>
                                        {genresLoading ? "Ładowanie gatunków…" : "Wybierz gatunek…"}
                                    </option>
                                    {genresSorted.map((g) => (
                                        <option key={g.genreID} value={g.genreID}>
                                            {g.genreName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={styles.field}>
                                <div style={styles.label}>Opis utworu (opcjonalnie)</div>
                                <textarea
                                    value={editSongDescription}
                                    onChange={(e) => setEditSongDescription(e.target.value)}
                                    maxLength={2000}
                                    placeholder="Geneza utworu, inspiracje, historia powstania…"
                                    style={styles.textarea}
                                    disabled={editBusy}
                                />
                                <div style={styles.smallHint}>{editSongDescription.length}/2000</div>
                            </div>
                        </div>

                        <div style={styles.modalFooter}>
                            <button type="button" onClick={closeEdit} style={styles.ghostBtn} disabled={editBusy}>
                                Anuluj
                            </button>

                            <button
                                type="button"
                                onClick={saveEdit}
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
        </div>
    );
}

const styles = {
    wrap: { position: "relative" },

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

    headRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 10,
    },
    headLeft: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
    title: { fontWeight: 900, opacity: 0.95 },
    count: {
        fontSize: 12,
        opacity: 0.65,
        border: "1px solid #2a2a2a",
        padding: "4px 10px",
        borderRadius: 999,
    },

    addBtn: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 12,
        border: "none",
        background: "#1db954",
        color: "#000",
        fontWeight: 900,
        cursor: "pointer",
    },

    empty: { opacity: 0.75, fontSize: 13, padding: "6px 2px" },

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
        flex: "0 0 auto",
        border: "1px solid #2a2a2a",
    },
    coverImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
    coverPh: { width: "100%", height: "100%", background: "#2a2a2a" },

    rowTitleLink: {
        fontWeight: 900,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        cursor: "pointer",
    },

    rowSub: { fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    rowBtns: { display: "flex", alignItems: "center", gap: 8 },

    editBtn: {
        width: 38,
        height: 36,
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "transparent",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        opacity: 0.9,
    },

    delBtn: {
        width: 38,
        height: 36,
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "transparent",
        color: "#ffb4b4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
        width: "min(720px, 100%)",
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

    modalBody: { padding: 14, display: "flex", flexDirection: "column", gap: 14 },

    field: { display: "flex", flexDirection: "column", gap: 6 },
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
        width: "100%",
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

    select: {
        width: "100%",
        borderRadius: 12,
        border: "1px solid #333",
        background: "#141414",
        color: "white",
        padding: "10px 12px",
        outline: "none",
    },

    smallHint: { fontSize: 12, opacity: 0.75 },

    modalFooter: {
        padding: 14,
        borderTop: "1px solid #2a2a2a",
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
    },

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

    rowDisabled: {
        opacity: 0.55,
        filter: "grayscale(0.25)",
    },

    badgePill: {
        fontSize: 12,
        fontWeight: 900,
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid #333",
        background: "#121212",
        opacity: 0.9,
        flex: "0 0 auto",
    },
};