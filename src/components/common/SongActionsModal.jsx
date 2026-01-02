import { useCallback } from "react";

export default function SongActionsModal({open, onClose, songTitle, canRemoveFromCurrent = false, onAddToPlaylist, onRemoveFromCurrent, busy = false,}) {
    const stop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    if (!open) return null;

    return (
        <div style={styles.backdrop} onMouseDown={onClose}>
            <div style={styles.modal} onMouseDown={stop}>
                <div style={styles.title} title={songTitle || ""}>
                    {songTitle || "Utwór"}
                </div>

                <div style={styles.buttons}>
                    <button
                        type="button"
                        onClick={onAddToPlaylist}
                        disabled={busy}
                        style={{
                            ...styles.btn,
                            opacity: busy ? 0.6 : 1,
                            cursor: busy ? "not-allowed" : "pointer",
                        }}
                    >
                        Dodaj do playlisty
                    </button>

                    {canRemoveFromCurrent ? (
                        <button
                            type="button"
                            onClick={onRemoveFromCurrent}
                            disabled={busy}
                            style={{
                                ...styles.btnDanger,
                                opacity: busy ? 0.6 : 1,
                                cursor: busy ? "not-allowed" : "pointer",
                            }}
                        >
                            Usuń z tej playlisty
                        </button>
                    ) : null}

                    <button type="button" onClick={onClose} style={styles.btnGhost}>
                        Anuluj
                    </button>
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
        zIndex: 1000,
        padding: 16,
    },
    modal: {
        width: "min(420px, 100%)",
        borderRadius: 14,
        border: "1px solid #2a2a2a",
        background: "#121212",
        padding: 14,
        boxShadow: "0 18px 48px rgba(0,0,0,0.55)",
    },
    title: {
        fontWeight: 900,
        marginBottom: 10,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    buttons: {
        display: "flex",
        flexDirection: "column",
        gap: 8,
    },
    btn: {
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "#1a1a1a",
        color: "white",
        padding: "10px 12px",
        textAlign: "left",
        fontWeight: 800,
    },
    btnDanger: {
        borderRadius: 12,
        border: "1px solid #3a1d1d",
        background: "#231010",
        color: "#ffb4b4",
        padding: "10px 12px",
        textAlign: "left",
        fontWeight: 900,
    },
    btnGhost: {
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "transparent",
        color: "white",
        padding: "10px 12px",
        textAlign: "left",
        fontWeight: 800,
        opacity: 0.85,
    },
};
