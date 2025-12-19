import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login as loginApi } from "../api/auth.api";

// 1. Context
const AuthContext = createContext(null);

// 2. Provider
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    const navigate = useNavigate();

    // --- Init auth on app start ---
    useEffect(() => {
        const storedToken = localStorage.getItem("token");

        if (!storedToken) {
            setLoading(false);
            return;
        }

        setToken(storedToken);

        fetch("http://localhost:3000/api/auth/me", {
            headers: {
                Authorization: `Bearer ${storedToken}`,
            },
        })
            .then((res) => {
                if (!res.ok) throw new Error("Unauthorized");
                return res.json();
            })
            .then((data) => {
                setUser(data.user);
            })
            .catch(() => {
                // token nieprawidłowy / wygasł
                localStorage.removeItem("token");
                setToken(null);
                setUser(null);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    // Login
    const login = async (userName, password) => {
        const result = await loginApi(userName, password);

        if (!result.success) {
            return result;
        }

        localStorage.setItem("token", result.token);
        setToken(result.token);

        // pobierz użytkownika
        const res = await fetch("http://localhost:3000/api/auth/me", {
            headers: {
                Authorization: `Bearer ${result.token}`,
            },
        });

        const data = await res.json();
        setUser(data.user);

        navigate("/home");

        return { success: true };
    };

    // Logout
    const logout = () => {
        localStorage.removeItem("token");
        setUser(null);
        setToken(null);
        navigate("/login");
    };

    const value = {
        user,
        token,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// 3. Hook
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
}
