import { useEffect, useRef, useState } from "react";
import { register } from "../../api/auth/auth.api.js";
import { useNavigate } from "react-router-dom";
import { formStyles as styles } from "../../styles/formStyles";

export default function RegisterForm() {
    const [userName, setUserName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const timerRef = useRef(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;

        setLoading(true);
        setError("");
        setSuccess("");

        // email optional: jeśli puste -> undefined
        const emailValue = email.trim() ? email.trim() : undefined;

        const result = await register(userName.trim(), password, emailValue);

        if (result.success) {
            setSuccess("Konto utworzone! Możesz się zalogować.");
            timerRef.current = setTimeout(() => navigate("/login"), 800);
        } else {
            setError(result.message || "Błąd rejestracji");
        }

        setLoading(false);
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
                type="email"
                placeholder="Email (opcjonalnie)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />

            <input
                style={styles.input}
                type="password"
                placeholder="Hasło"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
            />

            <button style={styles.button} type="submit" disabled={loading}>
                {loading ? "Rejestracja..." : "Zarejestruj się"}
            </button>

            {error && <p style={styles.message}>{error}</p>}
            {success && <p style={styles.message}>{success}</p>}
        </form>
    );
}
