import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");

        try {
            const res = await fetch("http://localhost:3000/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    userName: username,
                    password: password,
                }),
            });

            if (!res.ok) {
                const msg = await res.json();
                setError(msg.message || "Błąd logowania");
                return;
            }

            const data = await res.json();
            localStorage.setItem("token", data.token);

            navigate("/home");

        } catch (err) {
            console.error("LOGIN ERROR:", err);
            setError("Brak połączenia z serwerem.");
        }
    };

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <h2>Logowanie</h2>

                <form style={styles.form} onSubmit={handleLogin}>
                    <input
                        type="text"
                        placeholder="Login"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={styles.input}
                    />

                    <input
                        type="password"
                        placeholder="Hasło"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={styles.input}
                    />

                    <button style={styles.button} type="submit">
                        Zaloguj
                    </button>

                    {error && (
                        <p style={{ color: "red", marginTop: "10px" }}>
                            {error}
                        </p>
                    )}
                </form>
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
