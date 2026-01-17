import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { login as loginApi } from "../api/auth/auth.api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem("token"));
    const [loading, setLoading] = useState(true);

    const fetchMe = useCallback(async (tkn) => {
        const res = await fetch("http://localhost:3000/api/users/me", {
            headers: { Authorization: `Bearer ${tkn}` },
        });

        if (!res.ok) throw new Error("Unauthorized");
        const data = await res.json();
        return data.user;
    }, []);

    useEffect(() => {
        let alive = true;

        const init = async () => {
            if (!token) {
                if (alive) setLoading(false);
                return;
            }

            try {
                const me = await fetchMe(token);
                if (!alive) return;
                setUser(me);
            } catch {
                // token nieprawidłowy / wygasł
                localStorage.removeItem("token");
                if (!alive) return;
                setToken(null);
                setUser(null);
            } finally {
                if (alive) setLoading(false);
            }
        };

        init();
        return () => {
            alive = false;
        };
    }, [token, fetchMe]);

    // login
    const login = useCallback(async (userName, password) => {
        const result = await loginApi(userName, password);
        if (!result.success) return result;

        localStorage.setItem("token", result.token);
        setToken(result.token);

        try {
            const me = await fetchMe(result.token);
            setUser(me);
        } catch {
            localStorage.removeItem("token");
            setToken(null);
            setUser(null);
            return { success: false, message: "Nie udało się pobrać profilu użytkownika" };
        }

        return { success: true };
    }, [fetchMe]);

    const logout = useCallback(() => {
        localStorage.removeItem("token");
        setUser(null);
        setToken(null);
    }, []);

    const value = useMemo(
        () => ({
            user,
            token,
            loading,
            isAuthenticated: !!user,
            login,
            logout,
        }),
        [user, token, loading, login, logout]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}

