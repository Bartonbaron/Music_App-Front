import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api/http";
import { useAuth } from "../../contexts/AuthContext";

export default function AdminStatsPage() {
    const { token } = useAuth();

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            const data = await apiFetch("/admin/stats", { token });
            setStats(data);
        } catch (e) {
            setError(e.message || "Błąd pobierania statystyk");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line
    }, []);

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <h1 style={{ margin: 0 }}>Panel administratora</h1>
                <button onClick={load} style={styles.secondaryBtn} disabled={loading}>
                    Odśwież
                </button>
            </div>

            <h4>Globalne statystyki</h4>

            {error && <div style={styles.error}>{error}</div>}
            {loading && <div>Loading…</div>}

            {!loading && stats && (
                <>
                    <Section title="Użytkownicy">
                        <div style={styles.grid}>
                            <StatCard label="Liczba użytkowników" value={stats.users?.total ?? 0} />
                            <StatCard label="Aktywni użytkownicy" value={stats.users?.active ?? 0} />
                            <StatCard label="Nieaktywni użytkownicy" value={stats.users?.inactive ?? 0} />
                            <StatCard label="Liczba twórców" value={stats.users?.creators?.total ?? 0} />
                            <StatCard label="Aktywni twórcy" value={stats.users?.creators?.active ?? 0} />
                        </div>
                    </Section>

                    <Section title="Moderacja treści">
                        <div style={styles.grid}>
                            <StatCard label="Liczba utworów" value={stats.content?.songs?.total ?? 0} />
                            <StatCard label="Ukryte utwory" value={stats.content?.songs?.hidden ?? 0} />

                            <StatCard label="Liczba albumów" value={stats.content?.albums?.total ?? 0} />
                            <StatCard label="Ukryte albumy" value={stats.content?.albums?.hidden ?? 0} />

                            <StatCard label="Liczba playlist" value={stats.content?.playlists?.total ?? 0} />
                            <StatCard label="Ukryte playlisty" value={stats.content?.playlists?.hidden ?? 0} />

                            <StatCard label="Liczba podcastów" value={stats.content?.podcasts?.total ?? 0} />
                            <StatCard label="Ukryte podcasty" value={stats.content?.podcasts?.hidden ?? 0} />
                        </div>
                    </Section>

                    <Section title="Użytkowanie treści">
                        <div style={styles.grid}>
                            <StatCard label="Odtworzenia utworów" value={stats.usage?.songStreams ?? 0} />
                            <StatCard label="Odtworzenia podcastów" value={stats.usage?.podcastStreams ?? 0} />
                            <StatCard label="Wpisy do historii odtwarzania" value={stats.usage?.playHistoryEntries ?? 0} />
                            <StatCard label="Aktywne kolejki" value={stats.usage?.activeQueues ?? 0} />
                        </div>
                    </Section>

                    <Section title="Zgłoszenia">
                        <div style={styles.grid}>
                            <StatCard label="Oczekujące" value={stats.moderation?.reports?.pending ?? 0} />
                            <StatCard label="Przejrzane" value={stats.moderation?.reports?.reviewed ?? 0} />
                            <StatCard label="Zakończone" value={stats.moderation?.reports?.resolved ?? 0} />
                        </div>
                    </Section>
                </>
            )}
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div style={styles.section}>
            <h2 style={styles.title}>{title}</h2>
            {children}
        </div>
    );
}

function StatCard({ label, value }) {
    return (
        <div style={styles.card}>
            <div style={styles.cardBody}>
                <div style={{ opacity: 0.8, fontSize: 13 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 900 }}>{formatNumber(value)}</div>
            </div>
        </div>
    );
}

function formatNumber(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v ?? 0);
    return n.toLocaleString();
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
    section: { marginBottom: "40px" },
    title: { marginBottom: "15px" },

    error: {
        background: "#2a1a1a",
        border: "1px solid #5a2a2a",
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
    },

    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
        gap: "15px",
    },
    card: {
        backgroundColor: "#1e1e1e",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid #2a2a2a",
    },
    cardBody: { padding: 12, display: "flex", flexDirection: "column", gap: 8 },

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