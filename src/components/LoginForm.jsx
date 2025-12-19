import { useState } from "react";
import { login } from "../api/auth";

export default function LoginForm() {
    const [userName, setUserName] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();

        const result = await login(userName, password);

        if (result.success) {
            localStorage.setItem("token", result.token);
            setMessage("Zalogowano pomyślnie!");
            window.location.href = "/"; // przekierowanie np. na stronę główną
        } else {
            setMessage(result.message);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={styles.form}>
            <input
                style={styles.input}
                type="text"
                placeholder="Nazwa użytkownika"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
            />

            <input
                style={styles.input}
                type="password"
                placeholder="Hasło"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
            />

            <button style={styles.button} type="submit">
                Zaloguj się
            </button>

            {message && <p style={styles.message}>{message}</p>}
        </form>
    );
}

const styles = {
    form: { display: "flex", flexDirection: "column", gap: 12 },
    input: {
        padding: "10px 14px",
        borderRadius: 6,
        border: "1px solid #555",
        background: "#2a2a2a",
        color: "#fff",
    },
    button: {
        padding: "10px 14px",
        borderRadius: 6,
        border: "none",
        background: "#1db954",
        color: "#000",
        cursor: "pointer",
    },
    message: { color: "#fff", marginTop: 10 },
};
