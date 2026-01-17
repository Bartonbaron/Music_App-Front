import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { fetchMyFollowersStats } from "../../api/creators/creators.api.js";

export default function CreatorFollowersStatsPage() {
    const navigate = useNavigate();
    const { token, user } = useAuth();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const isCreator = useMemo(() => user?.role?.roleName === "Creator", [user?.role?.roleName]);

    const load = useCallback(async () => {
        if (!token) {
            setMsg("Zaloguj się, aby zobaczyć statystyki.");
            setData(null);
            return;
        }
        if (!isCreator) {
            setMsg("Ta strona jest dostępna tylko dla twórców.");
            setData(null);
            return;
        }

        setLoading(true);
        setMsg("");
        try {
            const res = await fetchMyFollowersStats(token);
            setData(res);
        } catch (e) {
            setMsg(e?.message || "Nie udało się pobrać statystyk.");
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [token, isCreator]);

    useEffect(() => {
        load();
    }, [load]);

    const daily = useMemo(() => {
        const arr = data?.dailyLast30Days;
        return Array.isArray(arr) ? arr : [];
    }, [data]);

    if (!token) {
        return <div style={styles.page}>Zaloguj się, aby zobaczyć statystyki.</div>;
    }

    if (!isCreator) {
        return <div style={styles.page}>Ta strona jest dostępna tylko dla twórców.</div>;
    }

    return (
        <div style={styles.page}>
            {/* TOP BAR */}
            <div style={styles.topBar}>
                <button type="button" onClick={() => navigate(-1)} style={styles.backBtn} title="Wstecz">
                    <ArrowLeft size={18} style={{ display: "block" }} />
                </button>
                <div style={{ opacity: 0.75, fontSize: 13 }}>Panel twórcy</div>
            </div>

            {/* HEADER */}
            <div style={styles.headerCard}>
                <div style={styles.headerRow}>
                    <div style={styles.iconWrap}>
                        <Users size={22} style={{ display: "block" }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={styles.kicker}>STATYSTYKI</div>
                        <h1 style={styles.h1}>Obserwujący</h1>
                        <div style={styles.sub}>Podsumowanie obserwujących Twojego profilu twórcy</div>
                    </div>

                    <button
                        type="button"
                        onClick={load}
                        disabled={loading}
                        style={{
                            ...styles.refreshBtn,
                            opacity: loading ? 0.6 : 1,
                            cursor: loading ? "not-allowed" : "pointer",
                        }}
                        title="Odśwież"
                    >
                        Odśwież
                    </button>
                </div>
            </div>

            {loading ? <div style={styles.hint}>Ładowanie…</div> : null}
            {msg ? <div style={styles.hint}>{msg}</div> : null}

            {!loading && data ? (
                <>
                    {/* KPI */}
                    <div style={styles.kpiGrid}>
                        <div style={styles.kpiCard}>
                            <div style={styles.kpiLabel}>Łącznie</div>
                            <div style={styles.kpiValue}>{Number(data.followersTotal || 0)}</div>
                        </div>

                        <div style={styles.kpiCard}>
                            <div style={styles.kpiLabel}>Ostatnie 7 dni</div>
                            <div style={styles.kpiValue}>{Number(data.followersLast7Days || 0)}</div>
                        </div>

                        <div style={styles.kpiCard}>
                            <div style={styles.kpiLabel}>Ostatnie 30 dni</div>
                            <div style={styles.kpiValue}>{Number(data.followersLast30Days || 0)}</div>
                        </div>
                    </div>

                    {/* DAILY */}
                    <div style={styles.card}>
                        <div style={styles.cardTitleRow}>
                            <div style={styles.cardTitle}>Przyrost dzienny (30 dni)</div>
                            <div style={{ marginLeft: "auto", opacity: 0.65, fontSize: 12 }}></div>
                        </div>

                        {daily.length === 0 ? (
                            <div style={{ opacity: 0.75, fontSize: 13 }}>Brak nowych obserwujących w ostatnich 30 dniach.</div>
                        ) : (
                            <div style={styles.table}>
                                <div style={{ ...styles.tr, ...styles.th }}>
                                    <div>Data</div>
                                    <div style={{ textAlign: "right" }}>Nowi</div>
                                </div>
                                {daily.map((r) => (
                                    <div key={r.date} style={styles.tr}>
                                        <div style={{ fontVariantNumeric: "tabular-nums" }}>{r.date}</div>
                                        <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 900 }}>
                                            {Number(r.count || 0)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            ) : null}

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

    headerCard: {
        background: "#1e1e1e",
        borderRadius: 14,
        border: "1px solid #2a2a2a",
        padding: 16,
        marginBottom: 14,
    },

    headerRow: { display: "flex", gap: 14, alignItems: "center" },

    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 14,
        background: "#141414",
        border: "1px solid #2a2a2a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
    },

    kicker: { fontSize: 12, opacity: 0.7, letterSpacing: 1.1, fontWeight: 900 },
    h1: { margin: "6px 0 6px", fontSize: 28, lineHeight: 1.1 },
    sub: { opacity: 0.75, fontSize: 13 },

    refreshBtn: {
        marginLeft: "auto",
        borderRadius: 12,
        border: "1px solid #2a2a2a",
        background: "#1a1a1a",
        color: "white",
        padding: "10px 12px",
        fontWeight: 900,
    },

    hint: {
        background: "#1b1b1b",
        border: "1px solid #2a2a2a",
        padding: 12,
        borderRadius: 12,
        opacity: 0.85,
        fontSize: 13,
        marginBottom: 12,
    },

    kpiGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 12,
        marginBottom: 12,
    },

    kpiCard: {
        background: "#1e1e1e",
        borderRadius: 14,
        border: "1px solid #2a2a2a",
        padding: 16,
    },

    kpiLabel: { opacity: 0.7, fontSize: 12, fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase" },
    kpiValue: { marginTop: 6, fontSize: 34, fontWeight: 900, fontVariantNumeric: "tabular-nums" },

    card: {
        background: "#1e1e1e",
        borderRadius: 14,
        border: "1px solid #2a2a2a",
        padding: 16,
    },

    cardTitleRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
    cardTitle: { fontWeight: 900, opacity: 0.95 },

    table: {
        border: "1px solid #2a2a2a",
        borderRadius: 12,
        overflow: "hidden",
        background: "#141414",
    },

    tr: {
        display: "grid",
        gridTemplateColumns: "1fr 120px",
        gap: 12,
        padding: "10px 12px",
        borderBottom: "1px solid #2a2a2a",
        alignItems: "center",
        fontSize: 13,
    },

    th: {
        fontWeight: 900,
        opacity: 0.9,
        background: "#101010",
    },
};