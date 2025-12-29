import { useState } from "react";
import { formStyles as styles } from "../../styles/formStyles";

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