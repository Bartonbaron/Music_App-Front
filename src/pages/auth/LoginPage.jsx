import { useState } from "react";
import LoginForm from "../../components/forms/LoginForm";
import { useAuth } from "../../contexts/AuthContext";
import { Link } from "react-router-dom";

export default function LoginPage() {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleLogin = async (e, userName, password) => {
        e.preventDefault();
        if (loading) return;

        setError("");
        setLoading(true);

        const result = await login(userName, password);

        if (!result.success) {
            setError(result.message);
            setLoading(false); // tylko przy błędzie
        }
    };

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <h2>Logowanie</h2>
                <LoginForm onSubmit={handleLogin} error={error} loading={loading} />
                <p style={styles.footer}>
                    Nie masz konta? <Link to="/register">Utwórz konto</Link>
                </p>
            </div>
        </div>
    );
}

const styles = {
    page: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#121212",
    },
    card: {
        backgroundColor: "#1e1e1e",
        padding: "30px",
        borderRadius: "12px",
        width: "350px",
        color: "white",
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
    },
    footer: { marginTop: 12, opacity: 0.85 },
};

