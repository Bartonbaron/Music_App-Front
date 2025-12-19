export async function login(userName, password) {
    try {
        const res = await fetch("http://localhost:3000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userName, password })
        });

        const data = await res.json();

        if (!res.ok) return { success: false, message: data.message };

        return { success: true, token: data.token };
    } catch (err) {
        return { success: false, message: "Network error" };
    }
}
