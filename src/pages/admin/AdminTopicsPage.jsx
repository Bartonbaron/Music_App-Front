import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Pencil, Trash2, X } from "lucide-react";
import { apiFetch } from "../../api/http";
import { useAuth } from "../../contexts/AuthContext";

function TopicModal({ open, onClose, initial, onSubmit, busy }) {
    const isEdit = !!initial?.topicID;
    const [topicName, setTopicName] = useState(initial?.topicName || "");
    const [description, setDescription] = useState(initial?.description || "");

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTopicName(initial?.topicName || "");
        setDescription(initial?.description || "");
    }, [initial]);

    if (!open) return null;

    return (
        <div style={styles.backdrop} onMouseDown={onClose}>
            <div style={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
                <div style={styles.modalTop}>
                    <div style={styles.modalTitle}>
                        {isEdit ? "Edytuj temat" : "Dodaj temat"}
                    </div>
                    <button type="button" onClick={onClose} style={styles.iconBtn} title="Zamknij">
                        <X size={16} />
                    </button>
                </div>

                <div style={styles.form}>
                    <label style={styles.label}>
                        Nazwa tematu
                        <input
                            value={topicName}
                            onChange={(e) => setTopicName(e.target.value)}
                            style={styles.input}
                            placeholder="np. Psychologia"
                            disabled={busy}
                        />
                    </label>

                    <label style={styles.label}>
                        Opis (opcjonalnie)
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            style={styles.textarea}
                            placeholder="Krótki opis tematu…"
                            disabled={busy}
                        />
                    </label>
                </div>

                <div style={styles.modalActions}>
                    <button
                        type="button"
                        onClick={() => onSubmit({ topicName: topicName.trim(), description: description.trim() })}
                        disabled={busy || !topicName.trim()}
                        style={{
                            ...styles.primaryBtn,
                            opacity: busy || !topicName.trim() ? 0.6 : 1,
                            cursor: busy || !topicName.trim() ? "not-allowed" : "pointer",
                        }}
                    >
                        {busy ? "…" : isEdit ? "Zapisz" : "Dodaj"}
                    </button>

                    <button type="button" onClick={onClose} disabled={busy} style={styles.ghostBtn}>
                        Anuluj
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminTopicsPage() {
    const { token } = useAuth();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [modalOpen, setModalOpen] = useState(false);
    const [modalBusy, setModalBusy] = useState(false);
    const [active, setActive] = useState(null);

    const count = useMemo(() => (Array.isArray(items) ? items.length : 0), [items]);

    const load = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError("");
        try {
            const res = await apiFetch("/topics", { token });
            setItems(Array.isArray(res) ? res : []);
        } catch (e) {
            setError(e?.message || "Błąd pobierania tematów");
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        load();
    }, [load]);

    const openCreate = useCallback(() => {
        setActive(null);
        setModalOpen(true);
    }, []);

    const openEdit = useCallback((t) => {
        setActive(t);
        setModalOpen(true);
    }, []);

    const submit = useCallback(
        async ({ topicName, description }) => {
            if (!token) return;
            setModalBusy(true);
            setError("");
            try {
                if (active?.topicID) {
                    await apiFetch(`/topics/${active.topicID}`, {
                        token,
                        method: "PATCH",
                        body: { topicName, description },
                    });
                } else {
                    await apiFetch("/topics", {
                        token,
                        method: "POST",
                        body: { topicName, description },
                    });
                }

                setModalOpen(false);
                setActive(null);
                await load();
            } catch (e) {
                setError(e?.message || "Błąd zapisu");
            } finally {
                setModalBusy(false);
            }
        },
        [token, active, load]
    );

    const remove = useCallback(
        async (t) => {
            if (!token || !t?.topicID) return;
            const ok = window.confirm(`Usunąć temat "${t.topicName}"?`);
            if (!ok) return;

            setError("");
            try {
                await apiFetch(`/topics/${t.topicID}`, { token, method: "DELETE" });
                await load();
            } catch (e) {
                setError(e?.message || "Błąd usuwania");
            }
        },
        [token, load]
    );

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <div>
                    <div style={styles.kicker}>ADMIN</div>
                    <h1 style={styles.h1}>Tematy podcastów</h1>
                    <div style={styles.sub}>{count} pozycji</div>
                </div>

                <div style={styles.headerActions}>
                    <button type="button" onClick={load} style={styles.iconBtn} title="Odśwież" disabled={loading}>
                        <RefreshCw size={16} />
                    </button>
                    <button type="button" onClick={openCreate} style={styles.addBtn} title="Dodaj temat">
                        <Plus size={16} /> Dodaj
                    </button>
                </div>
            </div>

            {error ? <div style={styles.error}>{error}</div> : null}
            {loading ? <div style={{ opacity: 0.75 }}>Ładowanie…</div> : null}

            {!loading && (
                <div style={styles.card}>
                    <table style={styles.table}>
                        <thead>
                        <tr>
                            <th style={styles.th}>ID</th>
                            <th style={styles.th}>Nazwa</th>
                            <th style={styles.th}>Opis</th>
                            <th style={{ ...styles.th, width: 140 }} />
                        </tr>
                        </thead>
                        <tbody>
                        {items.map((t) => (
                            <tr key={t.topicID}>
                                <td style={styles.tdMono}>{t.topicID}</td>
                                <td style={styles.tdStrong}>{t.topicName}</td>
                                <td style={styles.tdMuted}>{t.description || "—"}</td>
                                <td style={styles.tdRight}>
                                    <button
                                        type="button"
                                        onClick={() => openEdit(t)}
                                        style={styles.rowBtn}
                                        title="Edytuj"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => remove(t)}
                                        style={{ ...styles.rowBtn, ...styles.rowBtnDanger }}
                                        title="Usuń"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={4} style={{ padding: 14, opacity: 0.75 }}>
                                    Brak tematów.
                                </td>
                            </tr>
                        ) : null}
                        </tbody>
                    </table>
                </div>
            )}

            <TopicModal
                open={modalOpen}
                onClose={() => {
                    if (modalBusy) return;
                    setModalOpen(false);
                    setActive(null);
                }}
                initial={active}
                onSubmit={submit}
                busy={modalBusy}
            />

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
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 16,
        marginBottom: 18,
    },
    kicker: {
        fontSize: 12,
        opacity: 0.7,
        letterSpacing: 1.2,
        fontWeight: 900,
    },
    h1: {
        margin: "6px 0 6px",
        fontSize: 28,
        lineHeight: 1.1,
    },
    sub: {
        opacity: 0.75,
        fontSize: 13,
    },
    headerActions: {
        display: "flex",
        gap: 10,
        alignItems: "center",
    },
    iconBtn: {
        width: 40,
        height: 36,
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "transparent",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
    },
    addBtn: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 12px",
        borderRadius: 10,
        border: "none",
        background: "#1db954",
        color: "#000",
        fontWeight: 900,
        cursor: "pointer",
    },
    error: {
        background: "#2a1a1a",
        border: "1px solid #5a2a2a",
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
    },
    card: {
        background: "#1e1e1e",
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        overflow: "hidden",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
    },
    th: {
        textAlign: "left",
        fontSize: 12,
        letterSpacing: 0.6,
        opacity: 0.8,
        padding: "12px 14px",
        borderBottom: "1px solid #2a2a2a",
    },
    tdMono: {
        padding: "12px 14px",
        borderBottom: "1px solid #2a2a2a",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        opacity: 0.9,
    },
    tdStrong: {
        padding: "12px 14px",
        borderBottom: "1px solid #2a2a2a",
        fontWeight: 900,
    },
    tdMuted: {
        padding: "12px 14px",
        borderBottom: "1px solid #2a2a2a",
        opacity: 0.8,
    },
    tdRight: {
        padding: "12px 14px",
        borderBottom: "1px solid #2a2a2a",
        textAlign: "right",
        whiteSpace: "nowrap",
    },
    rowBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 32,
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "#141414",
        color: "white",
        cursor: "pointer",
        marginLeft: 8,
    },
    rowBtnDanger: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderColor: "#3a1d1d",
        background: "#231010",
        color: "#ffb4b4",
    },

    // modal
    backdrop: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
    },
    modal: {
        width: "min(520px, 100%)",
        borderRadius: 14,
        border: "1px solid #2a2a2a",
        background: "#121212",
        padding: 14,
        boxShadow: "0 18px 48px rgba(0,0,0,0.55)",
    },
    modalTop: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    modalTitle: {
        fontWeight: 900,
        fontSize: 16,
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginTop: 8,
    },
    label: {
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontSize: 12,
        opacity: 0.9,
        fontWeight: 800,
    },
    input: {
        height: 38,
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "#141414",
        color: "white",
        padding: "0 10px",
    },
    textarea: {
        minHeight: 90,
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "#141414",
        color: "white",
        padding: 10,
        resize: "vertical",
    },
    modalActions: {
        display: "flex",
        gap: 10,
        justifyContent: "flex-end",
        marginTop: 12,
    },
    primaryBtn: {
        padding: "10px 12px",
        borderRadius: 10,
        border: "none",
        background: "#1db954",
        color: "#000",
        fontWeight: 900,
    },
    ghostBtn: {
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "transparent",
        color: "white",
        fontWeight: 900,
        opacity: 0.9,
    },
};