import { Link, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { useLibrary } from "../../contexts/LibraryContext";
import { Library, Album, RefreshCw, ListMusic } from "lucide-react";

export default function Sidebar() {
    const { albums, playlists, loading, error, refetch } = useLibrary();
    const location = useLocation();

    const albumRows = useMemo(() => {
        return (albums || []).map((a) => ({
            key: `a-${a.albumID}`,
            id: a.albumID,
            title: a.albumName || "Album",
            sub: a.creatorName || a?.creator?.user?.userName || "—",
            cover: a.signedCover || null,
            href: `/albums/${a.albumID}`,
            isActive: location.pathname === `/albums/${a.albumID}`,
        }));
    }, [albums, location.pathname]);

    const playlistRows = useMemo(() => {
        return (playlists || []).map((p) => ({
            key: `p-${p.playlistID}`,
            id: p.playlistID,
            title: p.playlistName || "Playlista",
            sub: p.ownerName || p.userName || p?.user?.userName || p.creatorName || "—",
            cover: p.signedCover || null,
            href: `/playlists/${p.playlistID}`,
            isActive: location.pathname === `/playlists/${p.playlistID}`,
        }));
    }, [playlists, location.pathname]);

    return (
        <div style={styles.wrap}>
            {/* TOP */}
            <div style={styles.top}>
                <div style={styles.topTitleRow}>
                    <Library size={18} style={{ opacity: 0.9 }} />
                    <div style={styles.topTitle}>Moja biblioteka</div>
                </div>
            </div>

            {/* GLOBAL HEADER (refresh dla całej biblioteki) */}
            <div style={styles.globalHeader}>
                <button
                    onClick={refetch}
                    disabled={loading}
                    style={{
                        ...styles.refreshBtn,
                        opacity: loading ? 0.6 : 1,
                        cursor: loading ? "not-allowed" : "pointer",
                    }}
                    title="Odśwież bibliotekę"
                >
                    <RefreshCw size={16} style={{ display: "block" }} />
                </button>
            </div>

            {loading ? <div style={styles.hint}>Ładowanie…</div> : null}
            {error ? <div style={styles.hint}>{error}</div> : null}

            {/* ALBUMS */}
            <div style={styles.sectionHeader}>
                <div style={styles.sectionTitleRow}>
                    <Album size={16} style={{ opacity: 0.75 }} />
                    <div style={styles.sectionTitle}>Albumy</div>
                </div>
            </div>

            <div style={styles.list}>
                {!loading && albumRows.length === 0 ? (
                    <div style={styles.hint}>Brak albumów w bibliotece</div>
                ) : null}

                {albumRows.map((row) => (
                    <SidebarItem key={row.key} row={row} />
                ))}
            </div>

            {/* PLAYLISTS */}
            <div style={styles.sectionHeader}>
                <div style={styles.sectionTitleRow}>
                    <ListMusic size={16} style={{ opacity: 0.75 }} />
                    <div style={styles.sectionTitle}>Playlisty</div>
                </div>
            </div>

            <div style={styles.list}>
                {!loading && playlistRows.length === 0 ? (
                    <div style={styles.hint}>Brak playlist w bibliotece</div>
                ) : null}

                {playlistRows.map((row) => (
                    <SidebarItem key={row.key} row={row} />
                ))}
            </div>
        </div>
    );
}

function SidebarItem({ row }) {
    return (
        <Link
            to={row.href}
            style={{ ...styles.item, ...(row.isActive ? styles.itemActive : null) }}
            title={row.title}
        >
            <div style={styles.itemCover}>
                {row.cover ? (
                    <img src={row.cover} alt="" style={styles.itemCoverImg} />
                ) : (
                    <div style={styles.itemCoverPh} />
                )}
            </div>

            <div style={{ minWidth: 0 }}>
                <div style={styles.itemTitle}>{row.title}</div>
                <div style={styles.itemSub}>{row.sub}</div>
            </div>
        </Link>
    );
}

const styles = {
    wrap: { display: "flex", flexDirection: "column", height: "100%" },

    top: { padding: "12px 12px 6px" },
    topTitleRow: { display: "flex", alignItems: "center", gap: 8 },
    topTitle: { fontSize: 14, fontWeight: 900, letterSpacing: 0.2, opacity: 0.95 },

    globalHeader: {
        padding: "0 12px 10px",
        display: "flex",
        justifyContent: "flex-end",
    },

    sectionHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 12px 6px",
    },

    sectionTitleRow: { display: "flex", alignItems: "center", gap: 8 },
    sectionTitle: { fontSize: 12, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1 },

    refreshBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        border: "1px solid #333",
        background: "transparent",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    hint: { padding: "8px 12px", opacity: 0.7, fontSize: 13 },

    list: {
        display: "flex",
        flexDirection: "column",
        gap: 8,
        overflow: "auto",
        padding: "0 12px 12px",
    },

    item: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: 10,
        borderRadius: 12,
        textDecoration: "none",
        color: "white",
        border: "1px solid #2a2a2a",
        background: "#141414",
    },

    itemActive: {
        border: "1px solid #3a3a3a",
        background: "#1a1a1a",
    },

    itemCover: {
        width: 38,
        height: 38,
        borderRadius: 10,
        overflow: "hidden",
        background: "#2a2a2a",
        flex: "0 0 auto",
    },
    itemCoverImg: { width: "100%", height: "100%", objectFit: "cover" },
    itemCoverPh: { width: "100%", height: "100%", background: "#2a2a2a" },

    itemTitle: { fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    itemSub: { fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
};
