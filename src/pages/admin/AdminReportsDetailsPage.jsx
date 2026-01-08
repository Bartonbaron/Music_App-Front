import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../../api/http";
import { useAuth } from "../../contexts/AuthContext";

export default function AdminReportDetailsPage() {
    const { id } = useParams();
    const { token } = useAuth();

    const [report, setReport] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            const r = await apiFetch(`/admin/reports/${id}`, { token });
            setReport(r);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line
    }, [id]);

    const action = async (type) => {
        await apiFetch(`/admin/reports/${id}/action`, {
            token,
            method: "PATCH",
            body: { action: type },
        });
        load();
    };

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <h1>Zgłoszenie nr {id}</h1>
                <Link to="/admin/reports" style={styles.link}>← Powrót</Link>
            </div>

            {error && <div style={styles.error}>{error}</div>}
            {loading && <div>Loading…</div>}

            {report && (
                <div style={styles.card}>
                    <div style={styles.section}>
                        <strong>Typ:</strong> {report.contentType}<br />
                        <strong>Content ID:</strong> {report.contentID}<br />
                        <strong>Status:</strong> {report.status}<br />
                        <strong>Zgłaszający:</strong> {report.user?.userName}
                    </div>

                    <div style={styles.actions}>
                        <button style={styles.danger} onClick={() => action("HIDE")}>Ukryj</button>
                        <button style={styles.secondary} onClick={() => action("UNHIDE")}>Upublicznij</button>
                        <button style={styles.secondary} onClick={() => action("IGNORE")}>Zignoruj</button>
                    </div>

                    {report.content && (
                        <pre style={styles.pre}>
                            {JSON.stringify(report.content, null, 2)}
                        </pre>
                    )}
                </div>
            )}
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
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 30,
    },
    card: {
        background: "#1e1e1e",
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        padding: 20,
    },
    section: {
        marginBottom: 20,
        lineHeight: 1.6,
    },
    actions: {
        display: "flex",
        gap: 12,
        marginBottom: 20,
    },
    danger: {
        background: "#a33",
        border: "none",
        borderRadius: 10,
        padding: "10px 14px",
        fontWeight: 700,
        color: "white",
    },
    secondary: {
        background: "#2a2a2a",
        border: "1px solid #333",
        borderRadius: 10,
        padding: "10px 14px",
        fontWeight: 700,
        color: "white",
    },
    link: {
        color: "#1db954",
        fontWeight: 700,
        textDecoration: "none",
    },
    pre: {
        background: "#111",
        padding: 14,
        borderRadius: 10,
        fontSize: 12,
        overflowX: "auto",
    },
    error: {
        background: "#2a1a1a",
        border: "1px solid #5a2a2a",
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
    },
};