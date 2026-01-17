import { Link, useLocation } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import { useLibrary } from "../../contexts/LibraryContext";
import { useAuth } from "../../contexts/AuthContext";
import { createFolder } from "../../api/library/folders.api.js";
import { Library, Heart, Album, ListMusic, RefreshCw, Plus, Mic2, Folder } from "lucide-react";

export default function Sidebar({ onHoverChange }) {
    const { token } = useAuth();
    const { albums, playlists, favoriteSongs, favoritePodcasts, folders, loading, error, refetch } = useLibrary();
    const location = useLocation();

    const [creatingPlaylist, setCreatingPlaylist] = useState(false);
    const [creatingFolder, setCreatingFolder] = useState(false);

    const albumRows = useMemo(() => {
        return (albums || []).map((a) => ({
            key: `a-${a.albumID}`,
            title: a.albumName || "Album",
            cover: a.signedCover || null,
            href: `/albums/${a.albumID}`,
            isActive: location.pathname === `/albums/${a.albumID}`,
        }));
    }, [albums, location.pathname]);

    const playlistRows = useMemo(() => {
        return (playlists || []).map((p) => ({
            key: `p-${p.playlistID}`,
            title: p.playlistName || "Playlista",
            cover: p.signedCover || null,
            href: `/playlists/${p.playlistID}`,
            isActive: location.pathname === `/playlists/${p.playlistID}`,
        }));
    }, [playlists, location.pathname]);

    const folderRows = useMemo(
        () =>
            (folders || []).map((f) => ({
                key: `f-${f.folderID}`,
                title: f.folderName || "Folder",
                href: `/folders/${f.folderID}`,
                isActive: location.pathname === `/folders/${f.folderID}`,
            })),
        [folders, location.pathname]
    );

    const likedActive = location.pathname === "/liked-songs";
    const likedCount = (favoriteSongs || []).length;

    const myEpisodesActive = location.pathname === "/my-episodes";
    const myEpisodesCount = (favoritePodcasts || []).length;

    const createPlaylist = useCallback(async () => {
        if (!token) return;

        const playlistName = window.prompt("Nazwa playlisty:");
        if (!playlistName) return;

        setCreatingPlaylist(true);
        try {
            const res = await fetch("http://localhost:3000/api/playlists", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ playlistName }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "Nie udało się utworzyć playlisty");

            await refetch();
        } catch (e) {
            console.error("CREATE PLAYLIST ERROR:", e);
            alert(e?.message || "Błąd tworzenia playlisty");
        } finally {
            setCreatingPlaylist(false);
        }
    }, [token, refetch]);

    const createNewFolder = useCallback(async () => {
        if (!token) return;

        const name = window.prompt("Nazwa folderu:");
        if (!name) return;

        setCreatingFolder(true);
        try {
            await createFolder(token, name);
            await refetch();
        } catch (e) {
            alert(e?.message || "Błąd tworzenia folderu");
        } finally {
            setCreatingFolder(false);
        }
    }, [token, refetch]);

    const CoverPlaceholder = ({ type }) => {
        const Icon = type === "album" ? Album : ListMusic;

        return (
            <div style={styles.itemCoverPh}>
                <Icon size={18} style={{ opacity: 0.85, display: "block" }} />
            </div>
        );
    };

    return (
        <div style={styles.wrap}>
            {/* TOP */}
            <div style={styles.top}>
                <div style={styles.topTitleRow}>
                    <Library size={18} style={{ opacity: 0.9 }} />
                    <div style={styles.topTitle}>Moja biblioteka</div>
                </div>
            </div>

            {/* SCROLL (native) */}
            <div
                style={styles.scroll}
                onMouseEnter={() => onHoverChange?.(true)}
                onMouseLeave={() => onHoverChange?.(false)}
            >
                {/* Polubione utwory */}
                <div style={{ padding: "0 12px 10px" }}>
                    <Link to="/liked-songs" style={{ ...styles.item, ...(likedActive ? styles.itemActive : null) }} title="Polubione utwory">
                        <div style={styles.itemCover}>
                            <div style={{ ...styles.likedCover, ...(likedActive ? styles.likedCoverActive : null) }}>
                                <Heart size={16} style={{ display: "block" }} />
                            </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                            <div style={styles.itemTitle}>Polubione utwory</div>
                            <div style={styles.itemSub}>{likedCount ? `${likedCount} utw.` : "—"}</div>
                        </div>
                    </Link>
                </div>

                {/* Moje odcinki */}
                <div style={{ padding: "0 12px 10px" }}>
                    <Link to="/my-episodes" style={{ ...styles.item, ...(myEpisodesActive ? styles.itemActive : null) }} title="Ulubione podcasty">
                        <div style={styles.itemCover}>
                            <div style={{ ...styles.episodesCover, ...(myEpisodesActive ? styles.episodesCoverActive : null) }}>
                                <Mic2 size={16} style={{ display: "block" }} />
                            </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                            <div style={styles.itemTitle}>Moje odcinki</div>
                            <div style={styles.itemSub}>{myEpisodesCount ? `${myEpisodesCount} odc.` : "—"}</div>
                        </div>
                    </Link>
                </div>

                {/* ALBUMY */}
                <div style={styles.sectionHeader}>
                    <div style={styles.sectionTitleRow}>
                        <Album size={16} style={{ opacity: 0.75 }} />
                        <div style={styles.sectionTitle}>Albumy</div>
                    </div>

                    <button
                        onClick={refetch}
                        disabled={loading}
                        style={{
                            ...styles.refreshBtn,
                            opacity: loading ? 0.6 : 1,
                            cursor: loading ? "not-allowed" : "pointer",
                        }}
                        title="Odśwież bibliotekę"
                        type="button"
                    >
                        <RefreshCw size={16} style={{ display: "block" }} />
                    </button>
                </div>

                {loading ? <div style={styles.hint}>Ładowanie…</div> : null}
                {error ? <div style={styles.hint}>{error}</div> : null}

                <div style={styles.list}>
                    {!loading && albumRows.length === 0 ? <div style={styles.hint}>Brak albumów</div> : null}
                    {albumRows.map((r) => (
                        <Link key={r.key} to={r.href} style={{ ...styles.item, ...(r.isActive ? styles.itemActive : null) }} title={r.title}>
                            <div style={styles.itemCover}>
                                {r.cover ? (
                                    <img src={r.cover} alt="" style={styles.itemCoverImg} />
                                ) : (
                                    <CoverPlaceholder type="album" />
                                )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={styles.itemTitle}>{r.title}</div>
                                <div style={styles.itemSub}>{r.sub}</div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* PLAYLISTY */}
                <div style={styles.sectionHeader}>
                    <div style={styles.sectionTitleRow}>
                        <ListMusic size={16} style={{ opacity: 0.75 }} />
                        <div style={styles.sectionTitle}>Playlisty</div>
                    </div>

                    <button
                        onClick={createPlaylist}
                        disabled={!token || creatingPlaylist}
                        style={{
                            ...styles.refreshBtn,
                            opacity: !token || creatingPlaylist ? 0.6 : 1,
                            cursor: !token || creatingPlaylist ? "not-allowed" : "pointer",
                        }}
                        title="Utwórz playlistę"
                        type="button"
                    >
                        <Plus size={16} style={{ display: "block" }} />
                    </button>
                </div>

                <div style={styles.list}>
                    {!loading && playlistRows.length === 0 ? <div style={styles.hint}>Brak playlist</div> : null}
                    {playlistRows.map((r) => (
                        <Link key={r.key} to={r.href} style={{ ...styles.item, ...(r.isActive ? styles.itemActive : null) }} title={r.title}>
                            <div style={styles.itemCover}>
                                {r.cover ? (
                                    <img src={r.cover} alt="" style={styles.itemCoverImg} />
                                ) : (
                                    <CoverPlaceholder type="playlist" />
                                )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={styles.itemTitle}>{r.title}</div>
                                <div style={styles.itemSub}>{r.sub}</div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* FOLDERY */}
                <div style={styles.sectionHeader}>
                    <div style={styles.sectionTitleRow}>
                        <Folder size={16} style={{ opacity: 0.75 }} />
                        <div style={styles.sectionTitle}>Foldery</div>
                    </div>

                    <button
                        onClick={createNewFolder}
                        disabled={!token || creatingFolder}
                        style={{
                            ...styles.refreshBtn,
                            opacity: !token || creatingFolder ? 0.6 : 1,
                            cursor: !token || creatingFolder ? "not-allowed" : "pointer",
                        }}
                        title="Utwórz folder"
                        type="button"
                    >
                        <Plus size={16} style={{ display: "block" }} />
                    </button>
                </div>

                <div style={styles.list}>
                    {!loading && folderRows.length === 0 ? <div style={styles.hint}>Brak folderów</div> : null}
                    {folderRows.map((r) => (
                        <Link key={r.key} to={r.href} style={{ ...styles.item, ...(r.isActive ? styles.itemActive : null) }} title={r.title}>
                            <div style={styles.itemCover}>
                                <div style={styles.folderCover}>
                                    <Folder size={16} style={{ display: "block" }} />
                                </div>
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={styles.itemTitle}>{r.title}</div>
                                <div style={styles.itemSub}>Folder</div>
                            </div>
                        </Link>
                    ))}
                </div>

                <div style={{ height: 10 }} />
            </div>
        </div>
    );
}

const styles = {
    wrap: { display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" },

    top: { padding: "12px 12px 6px" },
    topTitleRow: { display: "flex", alignItems: "center", gap: 8 },
    topTitle: { fontSize: 14, fontWeight: 900, letterSpacing: 0.2, opacity: 0.95 },

    scroll: {
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        paddingBottom: 140,
        overscrollBehavior: "contain",
        scrollbarWidth: "thin",
        scrollbarColor: "#3a3a3a transparent",
    },

    sectionHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 12px",
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
        padding: 0,
    },

    hint: { padding: "8px 12px", opacity: 0.7, fontSize: 13 },

    list: { display: "flex", flexDirection: "column", gap: 8, padding: "0 12px 12px" },

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

    itemActive: { border: "1px solid #3a3a3a", background: "#1a1a1a" },

    itemCover: {
        width: 38,
        height: 38,
        borderRadius: 10,
        overflow: "hidden",
        background: "#2a2a2a",
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    likedCover: {
        width: 38,
        height: 38,
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
            "linear-gradient(135deg, rgba(29,185,84,0.95) 0%, rgba(120,70,255,0.95) 55%, rgba(255,80,180,0.95) 100%)",
        boxShadow: "0 8px 18px rgba(0,0,0,0.35)",
        color: "white",
    },

    likedCoverActive: { filter: "brightness(1.05)", boxShadow: "0 10px 22px rgba(0,0,0,0.45)" },

    episodesCover: {
        width: 38,
        height: 38,
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
            "linear-gradient(135deg, rgba(255,200,0,0.95) 0%, rgba(255,80,180,0.95) 55%, rgba(120,70,255,0.95) 100%)",
        boxShadow: "0 8px 18px rgba(0,0,0,0.35)",
        color: "white",
    },

    episodesCoverActive: { filter: "brightness(1.05)", boxShadow: "0 10px 22px rgba(0,0,0,0.45)" },

    folderCover: {
        width: 38,
        height: 38,
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 18px rgba(0,0,0,0.35)",
        color: "white",
    },

    itemCoverImg: { width: "100%", height: "100%", objectFit: "cover" },

    itemCoverPh: {
        width: "100%",
        height: "100%",
        background: "#2a2a2a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },


    itemTitle: { fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    itemSub: { fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
};