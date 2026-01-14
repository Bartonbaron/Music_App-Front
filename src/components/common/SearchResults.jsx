import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    Play,
    Music,
    Mic2,
    Album as AlbumIcon,
    ListMusic,
    User as UserIcon,
    Shield,
} from "lucide-react";

function pickCover(item) {
    // obsługa cover/avatara
    return (
        item?.signedCover ||
        item?.effectiveCover ||
        item?.signedProfilePicURL ||
        item?.profilePicSigned ||
        null
    );
}

function getLabel(item) {
    switch (item?.type) {
        case "song":
            return "UTWÓR";
        case "podcast":
            return "PODCAST";
        case "album":
            return "ALBUM";
        case "playlist":
            return "PLAYLISTA";
        case "creator":
            return "TWÓRCA";
        case "user":
            return "UŻYTKOWNIK";
        default:
            return "WYNIK";
    }
}

function getIcon(item) {
    switch (item?.type) {
        case "song":
            return <Music size={16} style={{ display: "block" }} />;
        case "podcast":
            return <Mic2 size={16} style={{ display: "block" }} />;
        case "album":
            return <AlbumIcon size={16} style={{ display: "block" }} />;
        case "playlist":
            return <ListMusic size={16} style={{ display: "block" }} />;
        case "creator":
            return <Shield size={16} style={{ display: "block" }} />;
        case "user":
        default:
            return <UserIcon size={16} style={{ display: "block" }} />;
    }
}

function getHref(item) {
    const id = item?.id;
    if (!id) return null;

    switch (item?.type) {
        case "song":
            return `/songs/${id}`;
        case "podcast":
            return `/podcasts/${id}`;
        case "album":
            return `/albums/${id}`;
        case "playlist":
            return `/playlists/${id}`;
        case "creator":
            return `/creators/${id}`;
        case "user":
            return `/users/${id}`;
        default:
            return null;
    }
}

export default function SearchResults({ results = [], onPlay, onClose }) {
    const navigate = useNavigate();

    const grouped = useMemo(() => {
        return Array.isArray(results) ? results.filter(Boolean) : [];
    }, [results]);

    const handleOpen = (item) => {
        const href = getHref(item);
        if (!href) return;
        onClose?.();
        navigate(href);
    };

    const canPlay = (item) => item?.type === "song" || item?.type === "podcast";

    const handleCoverClick = (item) => {
        if (!item) return;

        if (canPlay(item) && typeof onPlay === "function") {
            onPlay(item);
            return;
        }
        handleOpen(item);
    };

    return (
        <div style={styles.wrap}>
            {grouped.map((item) => {
                const cover = pickCover(item);
                const label = getLabel(item);

                const title = item?.title || "—";
                const subtitle = item?.subtitle || "";

                return (
                    <div key={`${item.type}-${item.id}-${item.userID ?? ""}`} style={styles.row}>
                        {/* COVER (klik = play / open) */}
                        <button
                            type="button"
                            style={styles.coverBtn}
                            onClick={() => handleCoverClick(item)}
                            title={canPlay(item) ? "Odtwórz" : "Otwórz"}
                        >
                            <div style={styles.cover}>
                                {cover ? (
                                    <img
                                        src={cover}
                                        alt=""
                                        style={styles.coverImg}
                                        referrerPolicy="no-referrer"
                                        crossOrigin="anonymous"
                                        onError={(e) => {
                                            e.currentTarget.onerror = null;
                                            e.currentTarget.src = "";
                                        }}
                                    />
                                ) : (
                                    <div style={styles.coverPh}>{getIcon(item)}</div>
                                )}

                                {/* overlay play tylko dla song/podcast */}
                                {canPlay(item) ? (
                                    <div style={styles.playOverlay}>
                                        <div style={styles.playBubble}>
                                            <Play size={16} style={{ display: "block" }} />
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </button>

                        {/* TEXT (klik = open details) */}
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={styles.kicker}>{label}</div>

                            <button
                                type="button"
                                onClick={() => handleOpen(item)}
                                style={styles.titleBtn}
                                title={title}
                            >
                                {title}
                            </button>

                            {subtitle ? <div style={styles.sub}>{subtitle}</div> : null}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

const styles = {
    wrap: {
        display: "flex",
        flexDirection: "column",
        gap: 10,
    },

    row: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 10,
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "#141414",
    },

    coverBtn: {
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        lineHeight: 0,
    },

    cover: {
        width: 46,
        height: 46,
        borderRadius: 12,
        overflow: "hidden",
        background: "#2a2a2a",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid #2a2a2a",
    },

    coverImg: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
    },

    coverPh: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: 0.9,
    },

    playOverlay: {
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: 0,
        transition: "opacity 0.15s",
        background: "rgba(0,0,0,0.35)",
    },

    playBubble: {
        width: 30,
        height: 30,
        borderRadius: 999,
        background: "rgba(29,185,84,0.95)",
        color: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 10px 20px rgba(0,0,0,0.45)",
        border: "1px solid rgba(0,0,0,0.15)",
    },

    kicker: {
        fontSize: 11,
        opacity: 0.65,
        letterSpacing: 0.7,
        fontWeight: 900,
        textTransform: "uppercase",
        marginBottom: 2,
    },

    titleBtn: {
        width: "100%",
        textAlign: "left",
        padding: 0,
        border: "none",
        background: "transparent",
        color: "white",
        fontWeight: 900,
        fontSize: 14,
        cursor: "pointer",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },

    sub: {
        fontSize: 12,
        opacity: 0.7,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        marginTop: 2,
    },
};
