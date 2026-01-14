const BASE_URL = "http://localhost:3000/api";

export async function apiFetch(path, { token, method = "GET", body, signal } = {}) {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let finalBody = body;
    if (body != null && !isFormData) {
        if (typeof body === "object") {
            headers["Content-Type"] = "application/json";
            finalBody = JSON.stringify(body);
        } else {
            finalBody = body;
        }
    }

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: method === "GET" ? undefined : finalBody,
        signal,
    });

    const text = await res.text();
    let data = null;

    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = { message: text };
    }

    if (!res.ok) {
        const err = new Error(data?.message || "Request failed");
        err.data = data;
        err.status = res.status;
        throw err;
    }

    return data;
}