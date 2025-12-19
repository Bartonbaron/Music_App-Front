import { useState } from "react";
import LoginForm from "../../components/forms/LoginForm";
import { useAuth } from "../../contexts/AuthContext";

export default function LoginPage() {
    const [error, setError] = useState("");
    const { login } = useAuth();

    const handleLogin = async (e, userName, password) => {
        e.preventDefault();
        setError("");

        const result = await login(userName, password);
        if (!result.success) {
            setError(result.message);
        }
    };

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <h2>Logowanie</h2>
                <LoginForm onSubmit={handleLogin} error={error} />
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
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "15px",
    },
    input: {
        padding: "12px",
        borderRadius: "6px",
        border: "none",
        backgroundColor: "#333",
        color: "white",
    },
    button: {
        padding: "12px",
        borderRadius: "6px",
        border: "none",
        backgroundColor: "#09A9ED",
        color: "white",
        fontWeight: "bold",
        cursor: "pointer",
    },
};
