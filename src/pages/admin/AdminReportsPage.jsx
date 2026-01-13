import React, { useEffect, useMemo, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../api/http";
import { useAuth } from "../../contexts/AuthContext";

const STATUSES = ["pending", "reviewed", "resolved"];

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
                gap: 8,
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${cfg.br}`,
                background: cfg.bg,
                color: cfg.fg,
                fontWeight: 900,
                fontSize: 12,
                lineHeight: 1,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                whiteSpace: "nowrap",
            }}
            title={s}
        >
      {STATUS_LABEL[s] || s}
    </span>
    );
}

export default function AdminReportsPage() {
    const { token } = useAuth();

    const [status, setStatus] = useState("pending");
    const [limit] = useState(50);
    const [offset, setOffset] = useState(0);

    const [data, setData] = useState({ total: 0, reports: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const canPrev = offset > 0;
    const canNext = useMemo(
        () => offset + limit < (data.total || 0),
        [offset, limit, data.total]
    );

    const pageFrom = data.total ? offset + 1 : 0;
    const pageTo = Math.min(offset + limit, data.total || 0);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const qs = new URLSearchParams({
                status,
                limit: String(limit),
                offset: String(offset),
            });
            const res = await apiFetch(`/admin/reports?${qs}`, { token });
            setData(Array.isArray(res) ? { total: res.length, reports: res } : res);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [status, limit, offset, token]);

    useEffect(() => {
        setOffset(0);
    }, [status]);

    useEffect(() => {
        load();
        // eslint-disable-next-line
    }, [status, limit, offset]);

    return (
        <div style={styles.page}>
            {/* Header */}
            <div style={styles.top}>
                <div style={{ minWidth: 0 }}>
                    <div style={styles.kicker}>ADMIN</div>
                    <h1 style={styles.h1}>Panel zgłoszeń</h1>
                    <div style={styles.sub}>
                        {loading ? (
                            <span style={{ opacity: 0.75 }}>Ładowanie…</span>
                        ) : (
                            <span style={{ opacity: 0.85 }}>
                {data.total || 0} zgłoszeń •{" "}
                                <span style={{ opacity: 0.7 }}>
                  {pageFrom}-{pageTo}
                </span>
              </span>
                        )}
                    </div>
                </div>

                <div style={styles.topActions}>
                    <button
                        type="button"
                        onClick={load}
                        disabled={loading}
                        style={{
                            ...styles.secondaryBtn,
                            opacity: loading ? 0.6 : 1,
                            cursor: loading ? "not-allowed" : "pointer",
                        }}
                        title="Odśwież"
                    >
                        <RefreshCw size={16} />
                    </button>

                    <div style={styles.pagerMini}>
                        <button
                            type="button"
                            disabled={!canPrev || loading}
                            onClick={() => setOffset((o) => o - limit)}
                            style={{
                                ...styles.pagerBtn,
                                opacity: !canPrev || loading ? 0.45 : 1,
                                cursor: !canPrev || loading ? "not-allowed" : "pointer",
                            }}
                        >
                            ←
                        </button>
                        <button
                            type="button"
                            disabled={!canNext || loading}
                            onClick={() => setOffset((o) => o + limit)}
                            style={{
                                ...styles.pagerBtn,
                                opacity: !canNext || loading ? 0.45 : 1,
                                cursor: !canNext || loading ? "not-allowed" : "pointer",
                            }}
                        >
                            →
                        </button>
                    </div>
                </div>
            </div>

            {/* Toolbar (sticky) */}
            <div style={styles.toolbar}>
                <div style={styles.tabs}>
                    {STATUSES.map((s) => {
                        const active = status === s;
                        return (
                            <button
                                key={s}
                                onClick={() => setStatus(s)}
                                style={{
                                    ...styles.tab,
                                    background: active ? "#1db954" : "#1e1e1e",
                                    color: active ? "#000" : "#fff",
                                    borderColor: active ? "#1db954" : "#2a2a2a",
                                }}
                                type="button"
                            >
                                {STATUS_LABEL[s] || s}
                            </button>
                        );
                    })}
                </div>

                <div style={styles.toolbarRight}>
                    <StatusPill status={status} />
                </div>
            </div>

            {error ? <div style={styles.error}>{error}</div> : null}

            {/* Table */}
            <div style={styles.card}>
                <div style={styles.tableWrap}>
                    <table style={styles.table}>
                        <thead>
                        <tr>
                            <th style={styles.th}>ID</th>
                            <th style={styles.th}>Typ</th>
                            <th style={styles.th}>Content</th>
                            <th style={styles.th}>Zgłaszający</th>
                            <th style={styles.th}>Status</th>
                            <th style={{ ...styles.th, textAlign: "right" }}>Akcja</th>
                        </tr>
                        </thead>

                        <tbody>
                        {loading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <tr key={`sk-${i}`} style={styles.tr}>
                                    <td style={styles.td}><div style={styles.skel} /></td>
                                    <td style={styles.td}><div style={styles.skel} /></td>
                                    <td style={styles.td}><div style={styles.skel} /></td>
                                    <td style={styles.td}><div style={styles.skel} /></td>
                                    <td style={styles.td}><div style={styles.skel} /></td>
                                    <td style={{ ...styles.td, textAlign: "right" }}><div style={{ ...styles.skel, width: 70 }} /></td>
                                </tr>
                            ))
                        ) : data.reports?.length ? (
                            data.reports.map((r) => (
                                <tr key={r.reportID} style={styles.tr}>
                                    <td style={styles.tdMono}>{r.reportID}</td>
                                    <td style={styles.td}>{r.contentType}</td>
                                    <td style={styles.tdMono}>#{r.contentID}</td>
                                    <td style={styles.tdEllipsis} title={r.user?.userName || "-"}>
                                        {r.user?.userName || "-"}
                                    </td>
                                    <td style={styles.td}>
                                        <StatusPill status={r.status} />
                                    </td>
                                    <td style={{ ...styles.td, textAlign: "right" }}>
                                        <Link to={`/admin/reports/${r.reportID}`} style={styles.openBtn}>
                                            Otwórz →
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td style={styles.empty} colSpan={6}>
                                    Brak zgłoszeń dla wybranego statusu.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bottom pagination (duże przyciski) */}
            <div style={styles.pagination}>
                <button
                    type="button"
                    disabled={!canPrev || loading}
                    onClick={() => setOffset((o) => o - limit)}
                    style={{
                        ...styles.secondaryBtn,
                        opacity: !canPrev || loading ? 0.5 : 1,
                        cursor: !canPrev || loading ? "not-allowed" : "pointer",
                    }}
                >
                    Poprzednia
                </button>

                <div style={{ opacity: 0.75, fontSize: 13 }}>
                    {pageFrom}-{pageTo} / {data.total || 0}
                </div>

                <button
                    type="button"
                    disabled={!canNext || loading}
                    onClick={() => setOffset((o) => o + limit)}
                    style={{
                        ...styles.secondaryBtn,
                        opacity: !canNext || loading ? 0.5 : 1,
                        cursor: !canNext || loading ? "not-allowed" : "pointer",
                    }}
                >
                    Następna
                </button>
            </div>

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
    },
    kicker: { fontSize: 12, opacity: 0.7, letterSpacing: 1.4, fontWeight: 900 },
    h1: { margin: "6px 0 4px", fontSize: 30, lineHeight: 1.1 },
    sub: { fontSize: 13, opacity: 0.85 },

    topActions: { display: "flex", gap: 10, alignItems: "center" },
    pagerMini: { display: "flex", gap: 8 },
    pagerBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "#1e1e1e",
        color: "#fff",
        fontWeight: 900,
        cursor: "pointer",
    },

    toolbar: {
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "rgba(18,18,18,0.92)",
        backdropFilter: "blur(8px)",
        border: "1px solid #2a2a2a",
        borderRadius: 14,
        padding: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 14,
    },

    tabs: { display: "flex", gap: 10, flexWrap: "wrap" },
    tab: {
        padding: "8px 14px",
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        fontWeight: 900,
        cursor: "pointer",
    },
    toolbarRight: { display: "flex", alignItems: "center", gap: 10 },

    card: {
        background: "#1e1e1e",
        borderRadius: 14,
        border: "1px solid #2a2a2a",
        overflow: "hidden",
    },

    tableWrap: {
        width: "100%",
        overflowX: "auto",
    },

    table: {
        width: "100%",
        borderCollapse: "collapse",
        minWidth: 820,
    },

    th: {
        textAlign: "left",
        fontSize: 12,
        letterSpacing: 1,
        textTransform: "uppercase",
        opacity: 0.75,
        padding: "12px 14px",
        borderBottom: "1px solid #2a2a2a",
        whiteSpace: "nowrap",
    },

    tr: {
        borderBottom: "1px solid #2a2a2a",
    },

    td: {
        padding: "12px 14px",
        fontSize: 13,
        verticalAlign: "middle",
        whiteSpace: "nowrap",
    },

    tdMono: {
        padding: "12px 14px",
        fontSize: 13,
        verticalAlign: "middle",
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
        opacity: 0.95,
    },

    tdEllipsis: {
        padding: "12px 14px",
        fontSize: 13,
        verticalAlign: "middle",
        maxWidth: 220,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },

    openBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "transparent",
        color: "#1db954",
        fontWeight: 900,
        textDecoration: "none",
        whiteSpace: "nowrap",
    },

    secondaryBtn: {
        padding: "10px 14px",
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "#1e1e1e",
        color: "#fff",
        fontWeight: 900,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
    },

    pagination: {
        display: "flex",
        gap: 12,
        marginTop: 14,
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
    },

    error: {
        background: "#2a1a1a",
        border: "1px solid #5a2a2a",
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
    },

    empty: {
        padding: 16,
        opacity: 0.75,
        textAlign: "center",
    },

    skel: {
        height: 14,
        width: "100%",
        borderRadius: 8,
        background: "#2a2a2a",
        opacity: 0.7,
    },
};