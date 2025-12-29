import RegisterForm from "../../components/forms/RegisterForm";
import { Link } from "react-router-dom";

export default function RegisterPage() {
    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <h2>Rejestracja</h2>
                <RegisterForm />

                <p style={{ marginTop: 16, fontSize: 14 }}>
                    Masz już konto? <Link to="/login">Zaloguj się</Link>
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
        background: "#121212",
    },
    card: {
        background: "#1e1e1e",
        padding: 30,
        borderRadius: 12,
        width: 360,
        color: "white",
    },
};
