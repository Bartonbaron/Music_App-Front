import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Search, ListMusic } from "lucide-react";

function pickPlaylistCover(p) {
    return p?.signedCover || p?.coverSigned || p?.coverURL || null;
}
function pickPlaylistName(p) {
    return p?.playlistName || p?.name || "Playlista";
}
function pickOwner(p) {
    return p?.user?.userName || p?.creatorName || p?.ownerName || "—";
}

export default function AddPlaylistToFolderModal({open, onClose, folderName,
options = [], onAdd, busy = false, onToast,}) {
    const [q, setQ] = useState("");
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) {
            setQ("");
            setBusyId(null);
            setError("");
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === "Escape") onClose?.();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const list = useMemo(() => {
        const arr = Array.isArray(options) ? options : [];
        const needle = q.trim().toLowerCase();
        if (!needle) return arr;

        return arr.filter((p) => {
            const name = pickPlaylistName(p).toLowerCase();
            const owner = pickOwner(p).toLowerCase();
            return name.includes(needle) || owner.includes(needle);
        });
    }, [options, q]);

    const handleAdd = useCallback(
        async (playlistID) => {
            if (!playlistID) return;
            if (busy || busyId) return;

            setError("");
            setBusyId(playlistID);
            try {
                await onAdd?.(playlistID);
                onToast?.("Dodano do folderu", "success");
                onClose?.();
            } catch (e) {
                const msg = e?.message || "Nie udało się dodać";
                setError(msg);
                onToast?.(msg, "error");
            } finally {
                setBusyId(null);
            }
        },
        [onAdd, busy, busyId, onClose, onToast]
    );

    if (!open) return null;

    return (
        <div
            style={styles.backdrop}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div style={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <div style={styles.titleRow}>
                        <div style={styles.iconBubble}>
                            <ListMusic size={16} style={{ display: "block" }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={styles.title}>Dodaj playlistę do folderu</div>
                            <div style={styles.subtitle} title={folderName || ""}>
                                {folderName ? folderName : "Folder"}
                            </div>
                        </div>
                    </div>

                    <button type="button" onClick={onClose} style={styles.closeBtn} title="Zamknij">
                        <X size={16} style={{ display: "block" }} />
                    </button>
                </div>

                <div style={styles.searchWrap}>
                    <Search size={16} style={{ opacity: 0.75, display: "block" }} />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Szukaj playlisty… (nazwa / właściciel)"
                        style={styles.searchInput}
                    />
                </div>

                {error ? <div style={styles.error}>{error}</div> : null}

                <div style={styles.list}>
                    {list.length === 0 ? (
                        <div style={styles.empty}>Brak playlist do dodania</div>
                    ) : (
                        list.map((p) => {
                            const cover = pickPlaylistCover(p);
                            const name = pickPlaylistName(p);
                            const owner = pickOwner(p);
                            const pid = p?.playlistID;

                            const rowBusy = String(busyId) === String(pid);
                            const disabled = !!busy || (!!busyId && !rowBusy);

                            return (
                                <button
                                    key={pid ?? name}
                                    type="button"
                                    onClick={() => handleAdd(pid)}
                                    disabled={disabled}
                                    style={{
                                        ...styles.rowBtn,
                                        opacity: disabled ? 0.55 : 1,
                                        cursor: disabled ? "not-allowed" : "pointer",
                                    }}
                                    title={name}
                                >
                                    <div style={styles.cover}>
                                        {cover ? <img src={cover} alt="" style={styles.coverImg} /> : <div style={styles.coverPh} />}
                                    </div>

                                    <div style={{ minWidth: 0 }}>
                                        <div style={styles.rowTitle}>{name}</div>
                                        <div style={styles.rowSub}>{owner}</div>
                                    </div>

                                    <div style={styles.rowRight}>
                                        <span style={styles.addPill}>{rowBusy ? "Dodaję…" : "Dodaj"}</span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

const styles = {
    backdrop: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
    },

    modal: {
        width: "min(620px, 100%)",
        borderRadius: 16,
        border: "1px solid #2a2a2a",
        background: "#141414",
        boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
        overflow: "hidden",
    },

    header: {
        padding: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        borderBottom: "1px solid #232323",
    },

    titleRow: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
    iconBubble: {
        width: 34,
        height: 34,
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "#101010",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    title: { fontWeight: 900, letterSpacing: 0.2 },
    subtitle: { fontSize: 12, opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "transparent",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        cursor: "pointer",
    },

    searchWrap: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderBottom: "1px solid #232323",
    },

    searchInput: {
        width: "100%",
        border: "none",
        outline: "none",
        background: "transparent",
        color: "white",
        fontSize: 14,
    },

    error: {
        padding: "10px 14px",
        color: "#ffb3b3",
        borderBottom: "1px solid #232323",
        fontSize: 13,
    },

    list: { maxHeight: 460, overflow: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 },

    empty: { padding: 10, opacity: 0.7, fontSize: 13 },

    rowBtn: {
        width: "100%",
        display: "grid",
        gridTemplateColumns: "44px 1fr auto",
        alignItems: "center",
        gap: 12,
        padding: 10,
        borderRadius: 14,
        border: "1px solid #2a2a2a",
        background: "#101010",
        color: "white",
        textAlign: "left",
    },

    cover: {
        width: 44,
        height: 44,
        borderRadius: 12,
        overflow: "hidden",
        background: "#2a2a2a",
    },
    coverImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
    coverPh: { width: "100%", height: "100%", background: "#2a2a2a" },

    rowTitle: { fontWeight: 850, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    rowSub: { fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

    rowRight: { display: "flex", alignItems: "center", justifyContent: "flex-end" },
    addPill: {
        padding: "8px 10px",
        borderRadius: 999,
        border: "1px solid #2a2a2a",
        background: "#141414",
        fontSize: 12,
        fontWeight: 850,
    },
};