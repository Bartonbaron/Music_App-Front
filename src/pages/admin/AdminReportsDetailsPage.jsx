import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { apiFetch } from "../../api/http";
import { useAuth } from "../../contexts/AuthContext";

const STATUS_LABEL = {
    pending: "Oczekujące",
    reviewed: "Przejrzane",
    resolved: "Rozwiązane",
};

function StatusPill({ status }) {
    const s = String(status || "").toLowerCase();
    const cfg =
        s === "pending"
            ? { bg: "#2a2014", br: "#6a4a1a", fg: "#ffd29a" }
            : s === "reviewed"
                ? { bg: "#1a2430", br: "#2a4a7a", fg: "#b9d7ff" }
                : s === "resolved"
                    ? { bg: "#142015", br: "#2a7a3a", fg: "#a7f3b8" }
                    : { bg: "#1c1c1c", br: "#2a2a2a", fg: "#ddd" };

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${cfg.br}`,
                background: cfg.bg,
                color: cfg.fg,
                fontWeight: 900,
                fontSize: 12,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
            }}
            title={s}
        >
      {STATUS_LABEL[s] || s}
    </span>
    );
}

function Field({ label, children, mono = false }) {
    return (
        <div style={styles.field}>
            <div style={styles.fieldLabel}>{label}</div>
            <div style={{ ...styles.fieldValue, ...(mono ? styles.mono : null) }}>
                {children}
            </div>
        </div>
    );
}

function guessPreview(content) {
    if (!content || typeof content !== "object") return null;

    const title =
        content.title ||
        content.name ||
        content.songName ||
        content.podcastName ||
        content.userName ||
        null;

    const description =
        content.description ||
        content.reason ||
        content.message ||
        content.text ||
        content.comment ||
        null;

    const creator =
        content.creatorName ||
        content.artistName ||
        content.author ||
        content.creator ||
        (content.user && content.user.userName) ||
        null;

    const extra = [];
    if (content.songID) extra.push({ k: "songID", v: content.songID });
    if (content.podcastID) extra.push({ k: "podcastID", v: content.podcastID });
    if (content.playlistID) extra.push({ k: "playlistID", v: content.playlistID });
    if (content.albumID) extra.push({ k: "albumID", v: content.albumID });

    return { title, description, creator, extra };
}

export default function AdminReportDetailsPage() {
    const { id } = useParams();
    const { token } = useAuth();

    const [report, setReport] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [busyAction, setBusyAction] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const r = await apiFetch(`/admin/reports/${id}`, { token });
            setReport(r);
            if (r?.status === "pending") {
                apiFetch(`/admin/reports/${id}/action`, {
                    token,
                    method: "PATCH",
                    body: { action: "REVIEW" },
                }).catch(() => {});
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [id, token]);

    useEffect(() => {
        load();
        // eslint-disable-next-line
    }, [id]);

    const isUserType = report?.contentType === "user";

    const doAction = useCallback(
        async (type) => {
            if (!type) return;

            if (type === "HIDE") {
                const ok = window.confirm(
                    isUserType
                        ? "Na pewno dezaktywować tego użytkownika?"
                        : "Na pewno ukryć zgłaszany content?"
                );
                if (!ok) return;
            }

            setBusyAction(type);
            try {
                await apiFetch(`/admin/reports/${id}/action`, {
                    token,
                    method: "PATCH",
                    body: { action: type },
                });
                await load();
            } catch (e) {
                setError(e.message || "Błąd akcji");
            } finally {
                setBusyAction("");
            }
        },
        [id, token, load, isUserType]
    );

    const contentPreview = useMemo(() => guessPreview(report?.content), [report?.content]);

    const copyJson = useCallback(async () => {
        try {
            const text = JSON.stringify(report?.content ?? {}, null, 2);
            await navigator.clipboard.writeText(text);
            alert("Skopiowano JSON do schowka");
            // eslint-disable-next-line no-unused-vars
        } catch (_) {
            alert("Nie udało się skopiować");
        }
    }, [report?.content]);

    // Sprawdzenie, czy content jest ukryty
    const isHidden = useMemo(() => {
        if (!report?.content) return null; // nie wiemy / brak contentu
        if (report.contentType === "user") {
            return Number(report.content.status) === 0;
        }
        return report.content.moderationStatus === "HIDDEN";
    }, [report]);

    const canUnhide = isHidden === true; // tylko gdy jest hidden
    const canHide = isHidden === false; // tylko gdy jest aktywny

    // Etykiety i title dla przycisków (user vs reszta)
    const hideLabel = isUserType ? "Dezaktywuj" : "Ukryj";
    const unhideLabel = isUserType ? "Aktywuj" : "Upublicznij";

    const hideTitle = !canHide
        ? isUserType
            ? "Użytkownik jest już dezaktywowany"
            : "Treść jest już ukryta"
        : isUserType
            ? "Dezaktywuj użytkownika"
            : "Ukryj content";

    const unhideTitle = !canUnhide
        ? isUserType
            ? "Użytkownik jest już aktywny"
            : "Treść jest już publiczna"
        : isUserType
            ? "Aktywuj użytkownika"
            : "Upublicznij content";

    return (
        <div style={styles.page}>
            {/* Top header */}
            <div style={styles.top}>
                <div style={{ minWidth: 0 }}>
                    <div style={styles.kicker}>ADMIN</div>
                    <div style={styles.titleRow}>
                        <h1 style={styles.h1}>Zgłoszenie #{id}</h1>
                        {report?.status ? <StatusPill status={report.status} /> : null}
                    </div>
                    <div style={styles.sub}>
                        <Link to="/admin/reports" style={styles.link}>
                            ← Powrót do listy
                        </Link>
                    </div>
                </div>

                <div style={styles.actionBar}>
                    <button
                        type="button"
                        onClick={() => doAction("HIDE")}
                        disabled={loading || !!busyAction || !canHide}
                        style={{
                            ...styles.dangerBtn,
                            opacity: loading || busyAction || !canHide ? 0.5 : 1,
                            cursor: loading || busyAction || !canHide ? "not-allowed" : "pointer",
                        }}
                        title={hideTitle}
                    >
                        {busyAction === "HIDE" ? "…" : hideLabel}
                    </button>

                    <button
                        type="button"
                        onClick={() => doAction("UNHIDE")}
                        disabled={loading || !!busyAction || !canUnhide}
                        style={{
                            ...styles.successBtn,
                            opacity: loading || busyAction || !canUnhide ? 0.5 : 1,
                            cursor: loading || busyAction || !canUnhide ? "not-allowed" : "pointer",
                        }}
                        title={unhideTitle}
                    >
                        {busyAction === "UNHIDE" ? "…" : unhideLabel}
                    </button>

                    <button
                        type="button"
                        onClick={() => doAction("IGNORE")}
                        disabled={loading || !!busyAction}
                        style={{
                            ...styles.secondaryBtn,
                            opacity: loading || busyAction ? 0.6 : 1,
                            cursor: loading || busyAction ? "not-allowed" : "pointer",
                        }}
                        title="Oznacz jako zignorowane"
                    >
                        {busyAction === "IGNORE" ? "…" : "Zignoruj"}
                    </button>

                    <button
                        type="button"
                        onClick={load}
                        disabled={loading || !!busyAction}
                        style={{
                            ...styles.ghostBtn,
                            opacity: loading || busyAction ? 0.6 : 1,
                            cursor: loading || busyAction ? "not-allowed" : "pointer",
                        }}
                        title="Odśwież"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {error ? <div style={styles.error}>{error}</div> : null}

            {/* Loading skeleton */}
            {loading ? (
                <div style={styles.grid}>
                    <div style={styles.card}>
                        <div style={styles.skelLine} />
                        <div style={styles.skelLine} />
                        <div style={styles.skelLine} />
                    </div>
                    <div style={styles.card}>
                        <div style={styles.skelLine} />
                        <div style={styles.skelLine} />
                        <div style={styles.skelLine} />
                    </div>
                </div>
            ) : null}

            {!loading && report ? (
                <>
                    {/* Meta grid */}
                    <div style={styles.grid}>
                        <div style={styles.card}>
                            <div style={styles.cardTitle}>Podstawowe informacje</div>
                            <div style={styles.fields}>
                                <Field label="Report ID" mono>
                                    {report.reportID ?? id}
                                </Field>
                                <Field label="Status">
                                    <StatusPill status={report.status} />
                                </Field>
                                <Field label="Typ" mono>
                                    {report.contentType || "—"}
                                </Field>
                                <Field label="Content ID" mono>
                                    {report.contentID != null ? `#${report.contentID}` : "—"}
                                </Field>
                                <Field label="Stan contentu">
                                    {isHidden === null ? (
                                        <span style={{ opacity: 0.65 }}>Brak danych</span>
                                    ) : isHidden ? (
                                        <span style={{ color: "#ffb4b4", fontWeight: 900 }}>
                      {isUserType ? "DEZAKTYWOWANY" : "UKRYTY"}
                    </span>
                                    ) : (
                                        <span style={{ color: "#a7f3b8", fontWeight: 900 }}>
                      {isUserType ? "AKTYWNY" : "PUBLICZNY"}
                    </span>
                                    )}
                                </Field>
                            </div>
                        </div>

                        <div style={styles.card}>
                            <div style={styles.cardTitle}>Zgłaszający</div>
                            <div style={styles.fields}>
                                <Field label="Nazwa użytkownika">{report.user?.userName || "—"}</Field>
                                <Field label="ID" mono>
                                    {report.user?.userID ?? report.user?.id ?? "—"}
                                </Field>
                            </div>
                        </div>
                    </div>

                    <div style={styles.sectionDivider} />

                    {/* Content preview */}
                    <div style={{ ...styles.card, ...(styles.previewCard || null) }}>
                        <div style={styles.cardTitleRow}>
                            <div style={styles.cardTitle}>Podgląd contentu</div>
                            {report.content ? (
                                <button type="button" onClick={copyJson} style={styles.smallBtn}>
                                    Kopiuj JSON
                                </button>
                            ) : null}
                        </div>

                        {!report.content ? (
                            <div style={{ opacity: 0.75, fontSize: 13 }}>
                                Brak danych contentu w odpowiedzi API.
                            </div>
                        ) : (
                            <>
                                {contentPreview ? (
                                    <div style={styles.preview}>
                                        <div style={styles.previewMain}>
                                            <div style={styles.previewTitle}>{contentPreview.title || "—"}</div>
                                            {contentPreview.creator ? (
                                                <div style={styles.previewSub}>{contentPreview.creator}</div>
                                            ) : null}
                                            {contentPreview.description ? (
                                                <div style={styles.previewDesc}>{contentPreview.description}</div>
                                            ) : null}
                                        </div>

                                        {contentPreview.extra?.length ? (
                                            <div style={styles.previewMeta}>
                                                {contentPreview.extra.map((x) => (
                                                    <div key={x.k} style={styles.kv}>
                                                        <span style={styles.kvK}>{x.k}</span>
                                                        <span style={styles.kvV}>{String(x.v)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}

                                {/* Raw JSON (collapsible) */}
                                <details style={styles.details}>
                                    <summary style={styles.summary}>Raw JSON</summary>
                                    <pre style={styles.pre}>{JSON.stringify(report.content, null, 2)}</pre>
                                </details>
                            </>
                        )}
                    </div>
                </>
            ) : null}

            {!loading && !report && !error ? (
                <div style={styles.card}>
                    <div style={{ opacity: 0.8 }}>Nie znaleziono zgłoszenia.</div>
                </div>
            ) : null}

            <div style={{ height: 120 }} />
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        backgroundColor: "#121212",
        color: "white",
        padding: "22px 40px",
    },

    top: {
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 14,
        marginBottom: 14,
        flexWrap: "wrap",
    },

    kicker: { fontSize: 12, opacity: 0.7, letterSpacing: 1.4, fontWeight: 900 },
    titleRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
    h1: { margin: "6px 0 0", fontSize: 30, lineHeight: 1.1 },
    sub: { marginTop: 6 },

    actionBar: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

    card: {
        background: "#1e1e1e",
        borderRadius: 14,
        border: "1px solid #2a2a2a",
        padding: 16,
    },

    grid: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        gap: 12,
        marginTop: 12,
    },

    cardTitle: { fontWeight: 900, marginBottom: 12, opacity: 0.95 },
    cardTitleRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 10,
    },

    fields: { display: "grid", gap: 10 },
    field: {
        display: "grid",
        gridTemplateColumns: "140px minmax(0, 1fr)",
        gap: 10,
        alignItems: "baseline",
    },
    fieldLabel: {
        fontSize: 12,
        opacity: 0.7,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        fontWeight: 900,
    },
    fieldValue: {
        fontSize: 13,
        opacity: 0.95,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    mono: {
        fontVariantNumeric: "tabular-nums",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    },

    preview: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 260px",
        gap: 14,
        alignItems: "start",
        padding: 12,
        borderRadius: 14,
        border: "1px solid #2a2a2a",
        background: "#161616",
        marginBottom: 12,
    },

    previewMain: { minWidth: 0 },
    previewTitle: {
        fontWeight: 900,
        fontSize: 16,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    previewSub: {
        marginTop: 4,
        opacity: 0.75,
        fontSize: 13,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    previewDesc: { marginTop: 10, opacity: 0.9, fontSize: 13, lineHeight: 1.5 },

    previewMeta: {
        borderLeft: "1px solid #2a2a2a",
        paddingLeft: 12,
        display: "grid",
        gap: 10,
    },

    kv: { display: "grid", gap: 4 },
    kvK: {
        fontSize: 12,
        opacity: 0.7,
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: 0.6,
    },
    kvV: { fontSize: 13, fontVariantNumeric: "tabular-nums" },

    details: { marginTop: 6 },
    summary: { cursor: "pointer", fontWeight: 900, opacity: 0.9, marginBottom: 10 },
    pre: {
        background: "#0f0f0f",
        padding: 14,
        borderRadius: 12,
        fontSize: 12,
        overflowX: "auto",
        border: "1px solid #2a2a2a",
    },

    dangerBtn: {
        background: "#a33",
        border: "1px solid #7a2a2a",
        borderRadius: 12,
        padding: "10px 14px",
        fontWeight: 900,
        color: "white",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
    },

    secondaryBtn: {
        background: "#1e1e1e",
        border: "1px solid #2a2a2a",
        borderRadius: 12,
        padding: "10px 14px",
        fontWeight: 900,
        color: "white",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
    },

    successBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 16px",
        borderRadius: 12,
        border: "none",
        background: "#1db954",
        color: "#000000",
        fontWeight: 900,
        textDecoration: "none",
        whiteSpace: "nowrap",
        transition: "background 0.2s",
    },

    ghostBtn: {
        width: 42,
        height: 42,
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "transparent",
        color: "white",
        fontWeight: 900,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
    },

    smallBtn: {
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "#1e1e1e",
        color: "white",
        padding: "8px 12px",
        fontWeight: 900,
        cursor: "pointer",
    },

    link: { color: "#1db954", fontWeight: 900, textDecoration: "none" },

    error: {
        background: "#2a1a1a",
        border: "1px solid #5a2a2a",
        padding: 12,
        borderRadius: 10,
        marginTop: 12,
    },

    skelLine: {
        height: 14,
        borderRadius: 8,
        background: "#2a2a2a",
        opacity: 0.7,
        marginBottom: 10,
    },

    sectionDivider: {
        marginTop: 26,
        marginBottom: 26,
        height: 1,
        background: "#2a2a2a",
        opacity: 1,
    },

    previewCard: {
        paddingTop: 22,
    },
};