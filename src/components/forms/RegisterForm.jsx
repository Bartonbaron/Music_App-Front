import { useState } from "react";
import { register } from "../../api/auth.api";
import { useNavigate } from "react-router-dom";
import { formStyles as styles } from "../../styles/formStyles";

export default function RegisterForm() {
    const [userName, setUserName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        const result = await register(userName, password, email);

        if (result.success) {
            setMessage("Konto utworzone! Możesz się zalogować.");
            setTimeout(() => navigate("/login"), 1200);
        } else {
            setMessage(result.message);
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

            {message && <p style={styles.message}>{message}</p>}
        </form>
    );
}