import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Mic2, Play, ArrowLeft, Flag } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { usePlayer } from "../../contexts/PlayerContext";
import { apiFetch } from "../../api/http";

import { fetchPodcast } from "../../api/content/podcasts.api.js";
import { mapPodcastToPlayerItem } from "../../utils/playerAdapter";
import FavoritePodcastButton from "../../components/social/FavoritePodcastButton.jsx";
import { formatTrackDuration } from "../../utils/time.js";

export default function PodcastPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const { token, user } = useAuth();
    const { setNewQueue, currentItem, isPlaying } = usePlayer();

    const [podcast, setPodcast] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [toast, setToast] = useState(null);
    const showToast = useCallback((text, type = "success") => {
        setToast({ text, type });
        window.setTimeout(() => setToast(null), 1400);
    }, []);

    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState("");
    const [reportBusy, setReportBusy] = useState(false);

    const isOwner = useMemo(() => {
        const myCreatorID = user?.creatorID ?? null;
        const ownerCreatorID = podcast?.creatorID ?? podcast?.raw?.creatorID ?? null;
        if (myCreatorID == null || ownerCreatorID == null) return false;
        return String(myCreatorID) === String(ownerCreatorID);
    }, [user, podcast]);

    const submitReport = useCallback(async () => {
        if (!token || !podcast?.podcastID) return;

        const reason = reportReason.trim();
        if (reason.length < 3) {
            showToast("Podaj powód (min. 3 znaki)", "error");
            return;
        }

        setReportBusy(true);
        try {
            await apiFetch("/reports", {
                token,
                method: "POST",
                body: {
                    contentType: "podcast",
                    contentID: Number(podcast.podcastID),
                    reason: reason.slice(0, 255),
                },
            });

            showToast("Zgłoszenie wysłane", "success");
            setReportOpen(false);
            setReportReason("");
        } catch (e) {
            showToast(e?.message || "Nie udało się wysłać zgłoszenia", "error");
        } finally {
            setReportBusy(false);
        }
    }, [token, podcast?.podcastID, reportReason, showToast]);

    useEffect(() => {
        if (!token || !id) return;

        let alive = true;
        setLoading(true);
        setError("");

        (async () => {
            try {
                const data = await fetchPodcast(token, id);
                const item = mapPodcastToPlayerItem(data);

                // Ujednolicenie duration (bez raw)
                const duration = data?.duration ?? item?.raw?.duration ?? null;

                if (alive) {
                    setPodcast({
                        ...item,
                        duration,
                        creatorID: data?.creatorID ?? item?.creatorID ?? item?.raw?.creatorID ?? null,
                    });
                }
            } catch (e) {
                if (alive) setError(e?.message || "Nie udało się pobrać podcastu");
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [token, id]);

    const playable = !!podcast?.signedAudio;

    const isNowPlaying = useMemo(() => {
        if (!currentItem || !podcast) return false;
        return (
            currentItem.type === "podcast" &&
            String(currentItem.podcastID) === String(podcast.podcastID)
        );
    }, [currentItem, podcast]);

    const nowPlayingLabel = useMemo(() => {
        if (!isNowPlaying) return "Podcast";
        return isPlaying ? "Teraz odtwarzane" : "Wstrzymane";
    }, [isNowPlaying, isPlaying]);

    const onPlay = useCallback(() => {
        if (!podcast?.signedAudio) return;
        setNewQueue([podcast], 0);
    }, [podcast, setNewQueue]);

    if (!token) {
        return (
            <div style={styles.page}>
                <div style={{ opacity: 0.75 }}>Zaloguj się, aby zobaczyć podcast.</div>
            </div>
        );
    }

    if (loading) return <div style={styles.page}>Ładowanie…</div>;
    if (error) return <div style={styles.page}>{error}</div>;
    if (!podcast) return <div style={styles.page}>Nie znaleziono podcastu.</div>;

    return (
        <div style={styles.page}>
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

            {/* MODAL: REPORT PODCAST */}
            {reportOpen ? (
                <div
                    style={styles.modalOverlay}
                    onMouseDown={() => {
                        if (!reportBusy) setReportOpen(false);
                    }}
                    role="dialog"
                    aria-modal="true"
                >
                    <div style={styles.modalCard} onMouseDown={(e) => e.stopPropagation()}>
                        <div style={styles.modalTitle}>Zgłoś podcast</div>

                        <div style={styles.modalHint}>Opisz krótko powód zgłoszenia (max 255 znaków).</div>

                        <textarea
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value.slice(0, 255))}
                            placeholder="Np. spam, obraźliwe treści, naruszenie praw…"
                            style={styles.textareaSmall}
                            disabled={reportBusy}
                        />

                        <div style={styles.modalFooterRow}>
                            <div style={styles.counter}>{reportReason.length}/255</div>

                            <div style={{ display: "flex", gap: 10 }}>
                                <button
                                    type="button"
                                    onClick={() => setReportOpen(false)}
                                    style={styles.ghostBtn}
                                    disabled={reportBusy}
                                >
                                    Anuluj
                                </button>

                                <button
                                    type="button"
                                    onClick={submitReport}
                                    disabled={reportBusy}
                                    style={{
                                        ...styles.reportBtn,
                                        opacity: reportBusy ? 0.65 : 1,
                                        cursor: reportBusy ? "not-allowed" : "pointer",
                                    }}
                                >
                                    <Flag size={16} style={{ display: "block" }} />
                                    {reportBusy ? "Wysyłanie…" : "Wyślij zgłoszenie"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* TOP BAR */}
            <div style={styles.topBar}>
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    style={styles.backBtn}
                    title="Wstecz"
                >
                    <ArrowLeft size={18} style={{ display: "block" }} />
                </button>

                <div style={{ opacity: 0.75, fontSize: 13 }}>{nowPlayingLabel}</div>
            </div>

            {/* HEADER */}
            <div style={styles.header}>
                <div style={styles.coverWrap}>
                    {podcast.signedCover ? (
                        <img src={podcast.signedCover} alt="" style={styles.coverImg} />
                    ) : (
                        <div style={styles.coverFallback}>
                            <Mic2 size={58} style={{ display: "block", opacity: 0.9 }} />
                        </div>
                    )}
                </div>

                <div style={styles.headerMain}>
                    <div style={styles.kicker}>ODCINEK</div>

                    <h1 style={styles.h1} title={podcast.title}>
                        {podcast.title || "Podcast"}
                    </h1>

                    {/* META + ACTIONS w jednym "pasku" */}
                    <div style={styles.metaActionsRow}>
                        <div style={styles.metaLine}>
                            <span style={{ opacity: 0.9 }}>{podcast.creatorName || "—"}</span>
                            <span style={{ opacity: 0.5 }}> • </span>
                            <span style={{ opacity: 0.85 }}>{formatTrackDuration(podcast.duration)}</span>
                        </div>

                        <div style={styles.actions}>
                            <button
                                type="button"
                                onClick={onPlay}
                                disabled={!playable}
                                style={{
                                    ...styles.primaryBtn,
                                    opacity: playable ? 1 : 0.6,
                                    cursor: playable ? "pointer" : "not-allowed",
                                }}
                                title={playable ? "Odtwórz" : "Podcast niedostępny"}
                            >
                                <Play size={16} style={{ display: "block" }} />
                                {isNowPlaying ? (isPlaying ? "Odtwarzasz" : "Wznów") : "Odtwórz"}
                            </button>

                            <FavoritePodcastButton
                                podcastID={podcast.podcastID}
                                size={16}
                                onToast={showToast}
                                title="Moje odcinki"
                                style={styles.favBtn}
                            />
                            {!isOwner ? (
                                <button
                                    type="button"
                                    onClick={() => setReportOpen(true)}
                                    style={styles.reportBtnSmall}
                                    title="Zgłoś podcast"
                                >
                                    <Flag size={16} style={{ display: "block" }} />
                                </button>
                            ) : null}
                        </div>
                    </div>

                    {/* Opis */}
                    {podcast.raw?.description ? (
                        <div style={styles.descriptionBlock}>
                            <div style={styles.descriptionTitle}>O odcinku</div>
                            <div style={styles.descriptionText}>{podcast.raw.description}</div>
                        </div>
                    ) : null}
                </div>
            </div>

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

    topBar: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 18,
    },

    backBtn: {
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
        lineHeight: 0,
        cursor: "pointer",
    },

    header: {
        display: "flex",
        gap: 18,
        alignItems: "flex-start",
        flexWrap: "wrap",
    },

    headerMain: {
        minWidth: 0,
        flex: 1,
    },

    coverWrap: {
        width: 200,
        height: 200,
        borderRadius: 14,
        overflow: "hidden",
        background: "#2a2a2a",
        border: "1px solid #2a2a2a",
        flex: "0 0 auto",
        maxWidth: "100%",
    },

    coverImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },

    coverFallback: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
            "linear-gradient(135deg, rgba(255,200,0,0.95) 0%, rgba(255,80,180,0.95) 55%, rgba(120,70,255,0.95) 100%)",
    },

    kicker: { fontSize: 12, opacity: 0.7, letterSpacing: 1.2, fontWeight: 900 },

    h1: {
        margin: "6px 0 8px",
        fontSize: 38,
        lineHeight: 1.08,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },

    metaLine: {
        opacity: 0.9,
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
    },

    metaActionsRow: {
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 14,
        background: "#161616",
        border: "1px solid #2a2a2a",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
    },

    actions: { marginTop: 0, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

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
    },

    favBtn: {
        width: 44,
        height: 40,
        borderRadius: 12,
    },

    descriptionBlock: {
        marginTop: 12,
        padding: "14px 16px",
        borderRadius: 14,
        background: "#1b1b1b",
        border: "1px solid #2a2a2a",
        maxWidth: 820,
    },

    descriptionTitle: {
        fontSize: 13,
        fontWeight: 900,
        opacity: 0.75,
        letterSpacing: 0.6,
        marginBottom: 8,
        textTransform: "uppercase",
    },

    descriptionText: {
        fontSize: 14,
        lineHeight: 1.6,
        opacity: 0.9,
        whiteSpace: "pre-wrap",
    },

    modalOverlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
        padding: 16,
    },

    modalCard: {
        width: "min(560px, 100%)",
        background: "#1e1e1e",
        border: "1px solid #2a2a2a",
        borderRadius: 14,
        padding: 14,
        boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
    },

    modalTitle: { fontWeight: 900, fontSize: 16, marginBottom: 10 },
    modalHint: { opacity: 0.85, fontSize: 13, marginBottom: 10 },

    textareaSmall: {
        width: "100%",
        minHeight: 110,
        resize: "vertical",
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "#121212",
        color: "white",
        padding: 12,
        outline: "none",
        fontSize: 13,
        boxSizing: "border-box",
    },

    modalFooterRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginTop: 12,
        flexWrap: "wrap",
    },

    counter: { opacity: 0.7, fontSize: 12 },

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
        fontWeight: 900,
    },

    reportBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #5a2a2a",
        background: "#2a1a1a",
        color: "#ffb4b4",
        fontWeight: 900,
    },

    reportBtnSmall: {
        width: 44,
        height: 40,
        borderRadius: 12,
        border: "1px solid #5a2a2a",
        background: "#2a1a1a",
        color: "#ffb4b4",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        fontWeight: 900,
    },
};