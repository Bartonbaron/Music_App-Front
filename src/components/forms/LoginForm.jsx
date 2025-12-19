import { useState } from "react";

export default function LoginForm({ onSubmit, error }) {
    const [userName, setUserName] = useState("");
    const [password, setPassword] = useState("");

    return (
        <form onSubmit={(e) => onSubmit(e, userName, password)} style={styles.form}>
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

            {error && <p style={styles.message}>{error}</p>}
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
