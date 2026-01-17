import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";

export default function AddToPlaylistButton({ songID, disabled, onToast }) {
    const { token } = useAuth();

    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [myPlaylists, setMyPlaylists] = useState([]);

    const safeToast = useCallback(
        (text, type = "success") => onToast?.(text, type),
        [onToast]
    );

    const fetchMyPlaylists = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetch("http://localhost:3000/api/playlists/my", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Nie udało się pobrać playlist");
            setMyPlaylists(Array.isArray(data) ? data : []);
        } catch (e) {
            safeToast(e?.message || "Błąd", "error");
        } finally {
            setLoading(false);
        }
    }, [token, safeToast]);

    useEffect(() => {
        if (!open) return;
        fetchMyPlaylists();
    }, [open, fetchMyPlaylists]);

    const addToPlaylist = useCallback(
        async (playlistID) => {
            if (!token || !songID) return;

            try {
                const res = await fetch(`http://localhost:3000/api/playlists/${playlistID}/songs`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ songID }),
                });

                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.message || "Nie udało się dodać utworu");

                safeToast("Dodano do playlisty", "success");
                setOpen(false);
            } catch (e) {
                safeToast(e?.message || "Błąd", "error");
            }
        },
        [token, songID, safeToast]
    );

    const rows = useMemo(() => {
        return (myPlaylists || []).map((p) => ({
            id: p.playlistID,
            name: p.playlistName || "Playlista",
        }));
    }, [myPlaylists]);

    return (
        <div style={{ position: "relative" }}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                disabled={disabled}
                title="Dodaj do playlisty"
                style={{
                    ...styles.btn,
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                }}
            >
                <MoreHorizontal size={16} style={{ display: "block" }} />
            </button>

            {open ? (
                <div style={styles.menu} onMouseLeave={() => setOpen(false)}>
                    <div style={styles.menuTitle}>Dodaj do playlisty</div>

                    {loading ? <div style={styles.menuItemMuted}>Ładowanie…</div> : null}
                    {!loading && rows.length === 0 ? (
                        <div style={styles.menuItemMuted}>Brak Twoich playlist</div>
                    ) : null}

                    {rows.map((r) => (
                        <button
                            key={r.id}
                            type="button"
                            onClick={() => addToPlaylist(r.id)}
                            style={styles.menuItemBtn}
                            title={r.name}
                        >
                            {r.name}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

const styles = {
    btn: {
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

    menu: {
        position: "absolute",
        right: 0,
        top: 40,
        width: 240,
        background: "#111",
        border: "1px solid #2a2a2a",
        borderRadius: 12,
        padding: 8,
        zIndex: 50,
        boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
    },

    menuTitle: {
        fontSize: 12,
        opacity: 0.7,
        letterSpacing: 0.4,
        padding: "6px 8px 8px",
        textTransform: "uppercase",
    },

    menuItemMuted: {
        padding: "8px 8px",
        fontSize: 13,
        opacity: 0.7,
    },

    menuItemBtn: {
        width: "100%",
        textAlign: "left",
        padding: "10px 10px",
        borderRadius: 10,
        border: "1px solid transparent",
        background: "transparent",
        color: "white",
        fontWeight: 700,
        cursor: "pointer",
    },
};
