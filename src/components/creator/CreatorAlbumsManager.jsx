import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Upload, X, Album, Image as ImageIcon } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "../../api/http";
import { fetchGenres } from "../../api/content/genres.api.js";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";

function pickAlbumTitle(a) {
    return a?.albumName || a?.title || "Album";
}

function pickAlbumCover(a) {
    return a?.signedCover || a?.coverSigned || a?.coverURL || null;
}

export default function CreatorAlbumsManager({ albums = [], onChanged }) {
    const { token } = useAuth();

    const navigate = useNavigate();

    const [toast, setToast] = useState(null);
    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1600);
    }, []);

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
        arr.sort((a, b) =>
            String(a?.genreName || "").localeCompare(String(b?.genreName || ""), "pl")
        );
        return arr;
    }, [genres]);

    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const [albumName, setAlbumName] = useState("");
    const [genreID, setGenreID] = useState("");
    const [releaseDate, setReleaseDate] = useState(""); // YYYY-MM-DD
    const [description, setDescription] = useState("");
    const [coverFile, setCoverFile] = useState(null);

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
        setAlbumName("");
        setGenreID("");
        setReleaseDate("");
        setDescription("");
        setCoverFile(null);
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

    const createAlbum = useCallback(async () => {
        if (!token) {
            showToast("Zaloguj się ponownie", "error");
            return;
        }

        const nameTrim = String(albumName || "").trim();
        if (!nameTrim) {
            showToast("Podaj nazwę albumu", "error");
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
            fd.append("albumName", nameTrim);
            fd.append("genreID", String(gid));

            const descTrim = String(description || "").trim();
            if (descTrim) fd.append("description", descTrim);

            // opcjonalna data premiery
            if (releaseDate) fd.append("releaseDate", releaseDate);

            // opcjonalna okładka
            if (coverFile) fd.append("cover", coverFile);

            // POST /api/albums
            await apiFetch("/albums", {
                token,
                method: "POST",
                body: fd,
            });

            showToast("Album utworzony", "success");
            setOpen(false);
            resetForm();

            if (typeof onChanged === "function") {
                await onChanged();
            }
        } catch (e) {
            showToast(e?.message || "Nie udało się utworzyć albumu", "error");
        } finally {
            setBusy(false);
        }
    }, [token, albumName, genreID, releaseDate, description, coverFile, showToast, resetForm, onChanged]);

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
                    <Album size={16} style={{ display: "block", opacity: 0.85 }} />
                    <div style={styles.title}>Albumy</div>
                    <div style={styles.count}>{Array.isArray(albums) ? albums.length : 0}</div>
                </div>

                <button type="button" onClick={openModal} style={styles.addBtn} title="Dodaj album">
                    <Plus size={16} style={{ display: "block" }} />
                    Dodaj
                </button>
            </div>

            {/* LIST (prosta – tylko podgląd) */}
            {!albums?.length ? (
                <div style={styles.empty}>Brak albumów.</div>
            ) : (
                <div style={styles.list}>
                    {albums.map((a) => {
                        const id = a?.albumID ?? a?.id;
                        const title = pickAlbumTitle(a);
                        const cover = pickAlbumCover(a);

                        const hidden = String(a?.moderationStatus || "ACTIVE").toUpperCase() === "HIDDEN";
                        const statusLabel = hidden ? "Ukryty" : null;
                        const rowDisabled = hidden;

                        return (
                            <div
                                key={id ?? title}
                                style={{
                                    ...styles.row,
                                    ...(rowDisabled ? styles.rowDisabled : null),
                                }}
                            >
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

                                <div
                                    style={{
                                        ...styles.rowTitleLink,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        minWidth: 0,
                                    }}
                                    title="Przejdź do szczegółów"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => navigate(`/albums/${id}`)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            navigate(`/albums/${id}`);
                                        }
                                    }}
                                >
                                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {title} <ExternalLink size={14} style={{ display: "inline-block", opacity: 0.85 }} />
                                </span>

                                    {statusLabel ? (
                                        <span style={styles.badgePill} title="Album ukryty przez moderację">
                                            {statusLabel}
                                        </span>
                                    ) : null}
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
                            <div style={{ fontWeight: 900 }}>Dodaj album</div>

                            <button type="button" onClick={closeModal} style={styles.iconX} title="Zamknij" disabled={busy}>
                                <X size={18} style={{ display: "block" }} />
                            </button>
                        </div>

                        <div style={styles.modalBody}>
                            <div style={styles.field}>
                                <div style={styles.label}>Nazwa albumu</div>
                                <input
                                    value={albumName}
                                    onChange={(e) => setAlbumName(e.target.value)}
                                    disabled={busy}
                                    style={styles.textInput}
                                    placeholder="Nazwa albumu…"
                                />
                            </div>

                            <div style={styles.field}>
                                <div style={styles.label}>Gatunek</div>
                                <select
                                    value={genreID}
                                    onChange={(e) => setGenreID(e.target.value)}
                                    disabled={busy || genresLoading}
                                    style={styles.select}
                                >
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
                                <div style={styles.label}>Data publikacji (opcjonalnie)</div>
                                <input
                                    type="date"
                                    value={releaseDate}
                                    onChange={(e) => setReleaseDate(e.target.value)}
                                    disabled={busy}
                                    style={styles.textInput}
                                />
                            </div>

                            <div style={styles.field}>
                                <div style={styles.label}>Opis (opcjonalnie)</div>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    maxLength={4000}
                                    placeholder="Opis albumu, historia powstania, koncepcja…"
                                    style={styles.textarea}
                                    disabled={busy}
                                />
                                <div style={styles.smallHint}>{String(description || "").length}/4000</div>
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
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={styles.modalFooter}>
                            <button type="button" onClick={closeModal} style={styles.ghostBtn} disabled={busy}>
                                Anuluj
                            </button>

                            <button
                                type="button"
                                onClick={createAlbum}
                                disabled={busy}
                                style={{
                                    ...styles.primaryBtn,
                                    opacity: busy ? 0.65 : 1,
                                    cursor: busy ? "not-allowed" : "pointer",
                                }}
                                title="Utwórz"
                            >
                                <Upload size={16} style={{ display: "block" }} />
                                {busy ? "Tworzenie…" : "Utwórz"}
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

    headLeft: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0,
    },

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

    rowTitle: {
        fontWeight: 900,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    rowSub: { fontSize: 12, opacity: 0.7 },

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
        width: "min(760px, 100%)",
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

    // tu jest „luz” od ramki (tak jak poprawiałeś w podcastach)
    modalBody: {
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
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

    select: {
        width: "100%",
        borderRadius: 12,
        border: "1px solid #333",
        background: "#141414",
        color: "white",
        padding: "10px 12px",
        outline: "none",
    },

    textarea: {
        minHeight: 130,
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

    smallHint: { fontSize: 12, opacity: 0.75 },

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

    rowTitleLink: {
        fontWeight: 900,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
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