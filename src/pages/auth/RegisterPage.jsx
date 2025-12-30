import RegisterForm from "../../components/forms/RegisterForm";
import {Link, Navigate} from "react-router-dom";
import {useAuth} from "../../contexts/AuthContext.jsx";

export default function RegisterPage() {
    const { token } = useAuth();
    if (token) return <Navigate to="/home" replace />;

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
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
    },
};
