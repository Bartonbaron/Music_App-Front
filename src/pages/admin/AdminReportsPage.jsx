import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../api/http";
import { useAuth } from "../../contexts/AuthContext";

const STATUSES = ["pending", "reviewed", "resolved"];

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

    const load = async () => {
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
    };

    useEffect(() => {
        setOffset(0);
    }, [status]);

    useEffect(() => {
        load();
        // eslint-disable-next-line
    }, [status, limit, offset]);

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <h1>Admin · Panel Zgłoszeń</h1>
            </div>

            <div style={styles.tabs}>
                {STATUSES.map(s => (
                    <button
                        key={s}
                        onClick={() => setStatus(s)}
                        style={{
                            ...styles.tab,
                            background: status === s ? "#1db954" : "#1e1e1e",
                            color: status === s ? "#000" : "#fff",
                        }}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {error && <div style={styles.error}>{error}</div>}
            {loading && <div>Loading…</div>}

            {!loading && (
                <div style={styles.card}>
                    <table style={styles.table}>
                        <thead>
                        <tr>
                            <th>ID</th>
                            <th>Typ</th>
                            <th>Content</th>
                            <th>Zgłaszający</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                        </thead>
                        <tbody>
                        {data.reports.map(r => (
                            <tr key={r.reportID}>
                                <td>{r.reportID}</td>
                                <td>{r.contentType}</td>
                                <td>#{r.contentID}</td>
                                <td>{r.user?.userName || "-"}</td>
                                <td>{r.status}</td>
                                <td>
                                    <Link to={`/admin/reports/${r.reportID}`} style={styles.link}>
                                        Open
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div style={styles.pagination}>
                <button disabled={!canPrev} onClick={() => setOffset(o => o - limit)}>
                    Poprzednia
                </button>
                <button disabled={!canNext} onClick={() => setOffset(o => o + limit)}>
                    Następna
                </button>
            </div>
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        backgroundColor: "#121212",
        color: "white",
        padding: "20px 40px",
    },
    header: {
        marginBottom: 30,
    },
    tabs: {
        display: "flex",
        gap: 10,
        marginBottom: 20,
    },
    tab: {
        padding: "8px 14px",
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        fontWeight: 700,
        cursor: "pointer",
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
    link: {
        color: "#1db954",
        fontWeight: 700,
        textDecoration: "none",
    },
    pagination: {
        display: "flex",
        gap: 10,
        marginTop: 20,
    },
    error: {
        background: "#2a1a1a",
        border: "1px solid #5a2a2a",
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
    },
};