export async function login(userName, password) {
    try {
        const res = await fetch("http://localhost:3000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userName, password }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            return { success: false, message: data?.message || "Nie udało się zalogować" };
        }

        return { success: true, token: data.token };
        // eslint-disable-next-line no-unused-vars
    } catch (err) {
        return { success: false, message: "Błąd sieci. Sprawdź połączenie z Internetem." };
    }
}

export async function register(userName, password, email) {
    try {
        const res = await fetch("http://localhost:3000/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userName, password, email }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            return {
                success: false,
                message: data?.message || "Nie udało się zarejestrować konta",
            };
        }

        return { success: true };
        // eslint-disable-next-line no-unused-vars
    } catch (err) {
        return { success: false, message: "Błąd sieci. Spróbuj ponownie za chwilę." };
    }
}