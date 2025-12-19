import { useAuth } from "../../contexts/AuthContext";

export default function HomePage() {
    const { user, logout } = useAuth();

    return (
        <div style={styles.page}>
            <header style={styles.header}>
                <h2>Witaj{user ? `, ${user.userName}` : ""}!</h2>

                <button style={styles.logoutBtn} onClick={logout}>
                    Wyloguj
                </button>
            </header>

            {/* reszta interfejsu */}
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

