import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function HomePage() {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return navigate("/login");

        // pobranie danych użytkownika (opcjonalnie)
        fetch("http://localhost:3000/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then((res) => res.json())
            .then((data) => setUser(data.user))
            .catch(() => navigate("/login"));
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <h2>Witaj{user ? `, ${user.userName}` : ""}!</h2>

                <button style={styles.logoutBtn} onClick={handleLogout}>
                    Wyloguj
                </button>
            </header>

            <div style={styles.section}>
                <h3 style={styles.title}>Ostatnio słuchane</h3>
                <div style={styles.grid}>
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} style={styles.card}>Utwór {i}</div>
                    ))}
                </div>
            </div>

            <div style={styles.section}>
                <h3 style={styles.title}>Proponowane playlisty</h3>
                <div style={styles.grid}>
                    {[1, 2, 3].map((i) => (
                        <div key={i} style={styles.card}>Playlista {i}</div>
                    ))}
                </div>
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
        display: "flex",
        justifyContent: "flex-start",
        gap: "30px",
        alignItems: "center",
        marginBottom: "35px",
    },
    logoutBtn: {
        padding: "10px 16px",
        backgroundColor: "#E53935",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        color: "white",
        fontWeight: "bold",
        marginLeft: "auto"
    },
    section: {
        marginBottom: "40px",
    },
    title: {
        marginBottom: "15px",
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: "15px",
    },
    card: {
        backgroundColor: "#1e1e1e",
        padding: "25px 15px",
        borderRadius: "10px",
        textAlign: "center",
        cursor: "pointer",
        transition: "0.2s",
    },
};

