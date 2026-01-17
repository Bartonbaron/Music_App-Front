import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Plus,
    Trash2,
    Upload,
    X,
    Mic2,
    Image as ImageIcon,
    Pencil,
    Save,
    ExternalLink,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "../../api/http";
import { fetchTopics } from "../../api/content/topics.api.js";

// Helpers
function pickPodcastTitle(p) {
    return p?.podcastName || p?.title || "Podcast";
}

function pickPodcastCover(p) {
    return p?.signedCover || p?.coverSigned || p?.coverURL || null;
}

function pickDuration(seconds) {
    const n = Number(seconds);
    if (!Number.isFinite(n) || n <= 0) return "—";
    const m = Math.floor(n / 60);
    const s = Math.floor(n % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}

function pickTopicName(p) {
    return p?.topic?.topicName || p?.topicName || null;
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

export default function CreatorPodcastsManager({ podcasts = [], onChanged }) {
    const navigate = useNavigate();
    const { token } = useAuth();

    // Toast
    const [toast, setToast] = useState(null);
    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1600);
    }, []);

    // Topics
    const [topics, setTopics] = useState([]);
    const [topicsLoading, setTopicsLoading] = useState(false);

    const loadTopics = useCallback(async () => {
        if (!token) return;
        setTopicsLoading(true);
        try {
            const res = await fetchTopics(token);
            const arr = Array.isArray(res) ? res : res?.topics;
            setTopics(Array.isArray(arr) ? arr : []);
        } catch (e) {
            console.warn("TOPICS LOAD ERROR:", e);
            setTopics([]);
        } finally {
            setTopicsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadTopics();
    }, [loadTopics]);

    const topicsSorted = useMemo(() => {
        const arr = Array.isArray(topics) ? [...topics] : [];
        arr.sort((a, b) => String(a?.topicName || "").localeCompare(String(b?.topicName || ""), "pl"));
        return arr;
    }, [topics]);

    // ADD (upload)
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const [audioFile, setAudioFile] = useState(null);
    const [coverFile, setCoverFile] = useState(null);
    const [topicID, setTopicID] = useState("");
    const [description, setDescription] = useState("");
    const [releaseDate, setReleaseDate] = useState("");

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
        setTopicID("");
        setDescription("");
        setReleaseDate("");
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

    const uploadPodcast = useCallback(async () => {
        if (!token) {
            showToast("Zaloguj się ponownie", "error");
            return;
        }
        if (!audioFile) {
            showToast("Wybierz plik audio", "error");
            return;
        }
        const tid = Number(topicID);
        if (!Number.isFinite(tid) || tid <= 0) {
            showToast("Wybierz temat", "error");
            return;
        }

        setBusy(true);
        try {
            const fd = new FormData();
            fd.append("file", audioFile);
            if (coverFile) fd.append("cover", coverFile);

            // backend wymaga topicID przy uploadzie
            fd.append("topicID", String(tid));

            const descTrim = String(description || "").trim();
            if (descTrim) fd.append("description", descTrim);

            if (releaseDate) fd.append("releaseDate", releaseDate);

            await apiFetch("/podcasts/upload", {
                token,
                method: "POST",
                body: fd,
            });

            showToast("Podcast dodany", "success");
            setOpen(false);
            resetForm();

            if (typeof onChanged === "function") {
                await onChanged();
            }
        } catch (e) {
            showToast(e?.message || "Nie udało się dodać podcastu", "error");
        } finally {
            setBusy(false);
        }
    }, [token, audioFile, coverFile, topicID, description, releaseDate, showToast, resetForm, onChanged]);

    // DELETE
    const [deletingID, setDeletingID] = useState(null);

    const deletePodcast = useCallback(
        async (id) => {
            if (!token) {
                showToast("Zaloguj się ponownie", "error");
                return;
            }
            if (!id) return;

            const ok = window.confirm("Na pewno usunąć ten podcast? Tej operacji nie da się cofnąć.");
            if (!ok) return;

            setDeletingID(String(id));
            try {
                await apiFetch(`/podcasts/${id}`, { token, method: "DELETE" });
                showToast("Podcast usunięty", "success");
                if (typeof onChanged === "function") await onChanged();
            } catch (e) {
                showToast(e?.message || "Nie udało się usunąć podcastu", "error");
            } finally {
                setDeletingID(null);
            }
        },
        [token, showToast, onChanged]
    );

    // EDIT (PATCH /:id)
    const [editOpen, setEditOpen] = useState(false);
    const [editBusy, setEditBusy] = useState(false);

    const [editID, setEditID] = useState(null);
    const [editName, setEditName] = useState("");
    const [editTopicID, setEditTopicID] = useState(""); // "" = nie zmieniaj
    const [editDescription, setEditDescription] = useState("");
    const [editReleaseDate, setEditReleaseDate] = useState("");
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

    const openEdit = useCallback((p) => {
        const id = p?.podcastID ?? p?.id ?? null;
        if (!id) return;

        setEditID(String(id));
        setEditName(String(pickPodcastTitle(p) || ""));
        setEditTopicID(""); // domyślnie: nie zmieniaj tematu
        setEditDescription(String(p?.description || ""));
        setEditReleaseDate(toDateInputValue(p?.releaseDate));
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
        if (!editID) return;

        const nameTrim = String(editName || "").trim();
        if (!nameTrim) {
            showToast("Nazwa nie może być pusta", "error");
            return;
        }

        // topic opcjonalny: wysyłamy tylko jeśli user wybrał
        let tid = null;
        if (editTopicID) {
            const t = Number(editTopicID);
            if (!Number.isFinite(t) || t <= 0) {
                showToast("Nieprawidłowy temat", "error");
                return;
            }
            tid = t;
        }

        setEditBusy(true);
        try {
            const fd = new FormData();
            fd.append("podcastName", nameTrim);

            if (tid != null) fd.append("topicID", String(tid));

            const descTrim = String(editDescription || "").trim();
            // jeśli chcesz umożliwić "wyczyszczenie" opisu — wysyłamy zawsze (tak jak w songs)
            fd.append("description", descTrim);

            if (editReleaseDate) fd.append("releaseDate", editReleaseDate);

            if (editCoverFile) fd.append("cover", editCoverFile);

            await apiFetch(`/podcasts/${editID}`, {
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
    }, [token, editID, editName, editTopicID, editDescription, editReleaseDate, editCoverFile, showToast, onChanged]);

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
                    <Mic2 size={16} style={{ display: "block", opacity: 0.85 }} />
                    <div style={styles.title}>Podcasty</div>
                    <div style={styles.count}>{Array.isArray(podcasts) ? podcasts.length : 0}</div>
                </div>

                <button type="button" onClick={openModal} style={styles.addBtn} title="Dodaj podcast">
                    <Plus size={16} style={{ display: "block" }} />
                    Dodaj
                </button>
            </div>

            {/* LIST */}
            {!podcasts?.length ? (
                <div style={styles.empty}>Brak podcastów.</div>
            ) : (
                <div style={styles.list}>
                    {podcasts.map((p) => {
                        const id = p?.podcastID ?? p?.id;
                        const cover = pickPodcastCover(p);
                        const title = pickPodcastTitle(p);
                        const dur = pickDuration(p?.duration);
                        const topicName = pickTopicName(p);

                        const hidden = String(p?.moderationStatus || "ACTIVE").toUpperCase() === "HIDDEN";
                        const statusLabel = hidden ? "Ukryty" : null;

                        const isDel = deletingID != null && String(id) === String(deletingID);
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

                                <div style={{ minWidth: 0, flex: 1 }}>
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
                                        title={hidden ? "Podcast ukryty przez moderację" : "Przejdź do szczegółów"}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => {
                                            if (hidden) return;
                                            navigate(`/podcasts/${id}`);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                if (hidden) return;
                                                navigate(`/podcasts/${id}`);
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
                                            <span style={styles.badgePill} title="Podcast ukryty przez moderację">
                                                {statusLabel}
                                            </span>
                                        ) : null}
                                    </div>

                                    <div style={styles.rowSub}>
                                        <span>{dur}</span>
                                        {topicName ? (
                                            <>
                                                <span style={{ opacity: 0.45 }}> • </span>
                                                <span>{topicName}</span>
                                            </>
                                        ) : null}
                                    </div>
                                </div>

                                <div style={styles.rowBtns}>
                                    <button
                                        type="button"
                                        onClick={() => openEdit(p)}
                                        disabled={rowDisabled}
                                        style={{
                                            ...styles.editBtn,
                                            opacity: rowDisabled ? 0.5 : 1,
                                            cursor: rowDisabled ? "not-allowed" : "pointer",
                                        }}
                                        title={rowDisabled ? "Podcast ukryty – edycja zablokowana" : "Edytuj"}
                                    >
                                        <Pencil size={16} style={{ display: "block" }} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => deletePodcast(id)}
                                        disabled={isDel || rowDisabled}
                                        style={{
                                            ...styles.delBtn,
                                            opacity: isDel || rowDisabled ? 0.5 : 1,
                                            cursor: isDel || rowDisabled ? "not-allowed" : "pointer",
                                        }}
                                        title={rowDisabled ? "Podcast ukryty – usuwanie zablokowane" : "Usuń"}
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
                            <div style={{ fontWeight: 900 }}>Dodaj podcast</div>
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
                                <div style={styles.label}>Temat</div>
                                <select
                                    value={topicID}
                                    onChange={(e) => setTopicID(e.target.value)}
                                    disabled={busy || topicsLoading}
                                    style={styles.select}
                                >
                                    <option value="" disabled>
                                        {topicsLoading ? "Ładowanie tematów…" : "Wybierz temat…"}
                                    </option>
                                    {topicsSorted.map((t) => (
                                        <option key={t.topicID} value={t.topicID}>
                                            {t.topicName}
                                        </option>
                                    ))}
                                </select>
                                {!topicsLoading && topicsSorted.length === 0 ? (
                                    <div style={styles.smallHint}>
                                        Brak tematów w bazie. Dodaj rekordy do tabeli <b>topics</b>.
                                    </div>
                                ) : null}
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
                                    placeholder="O czym jest odcinek? Linki, źródła, notatki…"
                                    style={styles.textarea}
                                    disabled={busy}
                                />
                                <div style={styles.smallHint}>{String(description || "").length}/4000</div>
                            </div>
                        </div>

                        <div style={styles.modalFooter}>
                            <button type="button" onClick={closeModal} style={styles.ghostBtn} disabled={busy}>
                                Anuluj
                            </button>

                            <button
                                type="button"
                                onClick={uploadPodcast}
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
                            <div style={{ fontWeight: 900 }}>Edytuj podcast</div>
                            <button type="button" onClick={closeEdit} style={styles.iconX} title="Zamknij" disabled={editBusy}>
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
                                    placeholder="Nazwa podcastu…"
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
                                <div style={styles.label}>Temat (opcjonalnie)</div>
                                <select
                                    value={editTopicID}
                                    onChange={(e) => setEditTopicID(e.target.value)}
                                    disabled={editBusy || topicsLoading}
                                    style={styles.select}
                                >
                                    <option value="">
                                        Nie zmieniaj tematu
                                    </option>
                                    {topicsSorted.map((t) => (
                                        <option key={t.topicID} value={t.topicID}>
                                            {t.topicName}
                                        </option>
                                    ))}
                                </select>
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
                            </div>

                            <div style={styles.field}>
                                <div style={styles.label}>Opis (opcjonalnie)</div>
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    maxLength={4000}
                                    style={styles.textarea}
                                    disabled={editBusy}
                                />
                                <div style={styles.smallHint}>{String(editDescription || "").length}/4000</div>
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

    rowSub: {
        fontSize: 12,
        opacity: 0.7,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },

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

    modalBody: {
        padding: 35,
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