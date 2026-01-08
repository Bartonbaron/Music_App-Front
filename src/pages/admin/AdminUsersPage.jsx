import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api/http";
import { useAuth } from "../../contexts/AuthContext";
import { Link } from "react-router-dom";

export default function AdminUsersPage() {
    const { token } = useAuth();

    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("all");

    const [limit, setLimit] = useState(50);
    const [offset, setOffset] = useState(0);

    const [data, setData] = useState({ total: 0, users: [] });
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState(null);
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
                limit: String(limit),
                offset: String(offset),
            });

            if (query.trim()) qs.set("query", query.trim());
            if (status !== "all") qs.set("status", status);

            const res = await apiFetch(`/admin/users?${qs.toString()}`, { token });

            if (Array.isArray(res)) {
                setData({ total: res.length, users: res });
            } else {
                setData(res);
            }
        } catch (e) {
            setError(e.message || "Błąd pobierania userów");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setOffset(0);
    }, [query, status, limit]);

    useEffect(() => {
        load();
        // eslint-disable-next-line
    }, [offset, query, status, limit]);

    const moderate = async (userID, action) => {
        setBusyId(userID);
        setError("");
        try {
            await apiFetch("/admin/moderation/user", {
                token,
                method: "PATCH",
                body: { userID, action },
            });
            await load();
        } catch (e) {
            setError(e.message || "Błąd moderacji usera");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <h1 style={{ margin: 0 }}>Admin · Użytkownicy</h1>
                <button onClick={load} style={styles.secondaryBtn} disabled={loading}>
                    Odśwież
                </button>
            </div>

            <div style={styles.filtersCard}>
                <div style={styles.filtersRow}>
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Szukaj po ID, nazwie lub mailu..."
                        style={styles.input}
                    />

                    <select value={status} onChange={(e) => setStatus(e.target.value)} style={styles.select}>
                        <option value="all">Wszyscy</option>
                        <option value="active">Aktywni</option>
                        <option value="inactive">Nieaktywni</option>
                    </select>

                    <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={styles.select}>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>

                <div style={styles.paginationRow}>
                    <div style={{ opacity: 0.8 }}>
                        Wyniki: {data.total ?? data.users?.length ?? 0} · Strona: {Math.floor(offset / limit) + 1}
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <button
                            disabled={!canPrev || loading}
                            onClick={() => setOffset((o) => Math.max(0, o - limit))}
                            style={styles.secondaryBtn}
                        >
                            Poprzednia
                        </button>
                        <button
                            disabled={!canNext || loading}
                            onClick={() => setOffset((o) => o + limit)}
                            style={styles.secondaryBtn}
                        >
                            Następna
                        </button>
                    </div>
                </div>
            </div>

            {error && <div style={styles.error}>{error}</div>}
            {loading && <div>Loading…</div>}

            {!loading && (
                <div style={styles.card}>
                    <div style={{ overflowX: "auto" }}>
                        <table style={styles.table}>
                            <thead>
                            <tr>
                                <th style={styles.th}>ID</th>
                                <th style={styles.th}>Użytkownik</th>
                                <th style={styles.th}>Email</th>
                                <th style={styles.th}>Rola</th>
                                <th style={styles.th}>Status</th>
                                <th style={styles.th}></th>
                            </tr>
                            </thead>
                            <tbody>
                            {(data.users || []).map((u) => {
                                const isActive = !!u.status;
                                const roleName = u.role?.roleName ?? u.roleName ?? `#${u.roleID}`;

                                return (
                                    <tr key={u.userID} style={styles.tr}>
                                        <td style={styles.td}>{u.userID}</td>
                                        <td style={styles.td}>
                                            <div style={{ display: "flex", flexDirection: "column" }}>
                                                <strong style={{ fontWeight: 900 }}>{u.userName}</strong>
                                                <span style={{ opacity: 0.7, fontSize: 12 }}>
                            <Link to={`/users/${u.userID}`} style={styles.link}>
                              Przejdź do profilu
                            </Link>
                          </span>
                                            </div>
                                        </td>
                                        <td style={styles.td}>{u.email || <span style={{ opacity: 0.6 }}>—</span>}</td>
                                        <td style={styles.td}>{roleName}</td>
                                        <td style={styles.td}>
                        <span
                            style={{
                                ...styles.badge,
                                background: isActive ? "#12301f" : "#2a1a1a",
                                borderColor: isActive ? "#1db954" : "#5a2a2a",
                                color: isActive ? "#1db954" : "#ff9b9b",
                            }}
                        >
                          {isActive ? "Aktywny" : "Nieaktywny"}
                        </span>
                                        </td>
                                        <td style={{ ...styles.td, textAlign: "right", whiteSpace: "nowrap" }}>
                                            {isActive ? (
                                                <button
                                                    disabled={busyId === u.userID}
                                                    onClick={() => moderate(u.userID, "DEACTIVATE")}
                                                    style={styles.dangerBtn}
                                                >
                                                    Dezaktywuj
                                                </button>
                                            ) : (
                                                <button
                                                    disabled={busyId === u.userID}
                                                    onClick={() => moderate(u.userID, "ACTIVATE")}
                                                    style={styles.playBtn}
                                                >
                                                    Aktywuj
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}

                            {(data.users || []).length === 0 && (
                                <tr>
                                    <td style={styles.td} colSpan={6}>
                                        Brak wyników.
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
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
        gap: "30px",
        alignItems: "center",
        marginBottom: "25px",
    },

    error: {
        background: "#2a1a1a",
        border: "1px solid #5a2a2a",
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
    },

    filtersCard: {
        backgroundColor: "#1e1e1e",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid #2a2a2a",
        padding: 12,
        marginBottom: 16,
    },
    filtersRow: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
        marginBottom: 12,
    },
    paginationRow: {
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
    },

    input: {
        flex: 1,
        minWidth: 240,
        background: "#121212",
        border: "1px solid #2a2a2a",
        borderRadius: 10,
        padding: "10px 12px",
        color: "white",
        outline: "none",
    },
    select: {
        background: "#121212",
        border: "1px solid #2a2a2a",
        borderRadius: 10,
        padding: "10px 12px",
        color: "white",
        outline: "none",
        fontWeight: 700,
    },

    card: {
        backgroundColor: "#1e1e1e",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid #2a2a2a",
    },
    table: { width: "100%", borderCollapse: "collapse" },
    th: {
        textAlign: "left",
        padding: 12,
        borderBottom: "1px solid #2a2a2a",
        fontWeight: 900,
        color: "#ddd",
        background: "#1a1a1a",
    },
    tr: {},
    td: {
        padding: 12,
        borderBottom: "1px solid #2a2a2a",
        verticalAlign: "top",
    },

    badge: {
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid",
        fontWeight: 900,
        fontSize: 12,
        letterSpacing: 0.5,
    },

    link: {
        color: "#1db954",
        fontWeight: 800,
        textDecoration: "none",
    },

    playBtn: {
        padding: "10px 12px",
        borderRadius: "10px",
        border: "none",
        background: "#1db954",
        color: "#000",
        fontWeight: 800,
        cursor: "pointer",
    },
    dangerBtn: {
        padding: "10px 12px",
        borderRadius: "10px",
        border: "1px solid #5a2a2a",
        background: "#2a1a1a",
        color: "#ffb3b3",
        fontWeight: 900,
        cursor: "pointer",
    },
    secondaryBtn: {
        padding: "10px 12px",
        borderRadius: "10px",
        border: "1px solid #2a2a2a",
        background: "#1e1e1e",
        color: "#fff",
        fontWeight: 800,
        cursor: "pointer",
    },
};