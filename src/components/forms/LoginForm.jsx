import { useState } from "react";
import { formStyles as styles } from "../../styles/formStyles";

export default function LoginForm({ onSubmit, error, loading = false }) {
    const [userName, setUserName] = useState("");
    const [password, setPassword] = useState("");

    return (
        <form onSubmit={(e) => onSubmit(e, userName.trim(), password)} style={styles.form}>
            <input
                style={styles.input}
                type="text"
                placeholder="Nazwa użytkownika lub email"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
                disabled={loading}
            />

            <input
                style={styles.input}
                type="password"
                placeholder="Hasło"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
            />

            <button style={styles.button} type="submit" disabled={loading}>
                {loading ? "Logowanie..." : "Zaloguj się"}
            </button>

            {error && <p style={styles.message}>{error}</p>}
        </form>
    );
}
