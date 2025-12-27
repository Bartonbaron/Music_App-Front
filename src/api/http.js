const BASE_URL = "http://localhost:3000/api";

export async function apiFetch(path, { token, ...options } = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            ...(options.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    const contentType = res.headers.get("content-type");
    const data = contentType?.includes("application/json") ? await res.json() : null;

    if (!res.ok) {
        const msg = data?.message || `Request failed: ${res.status}`;
        throw new Error(msg);
    }

    return data;
}
