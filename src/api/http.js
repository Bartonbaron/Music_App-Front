const BASE_URL = "http://localhost:3000/api";

export async function apiFetch(path, { token, method = "GET", body } = {}) {
    const url = `${BASE_URL}${path}`;

    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const isFormData = body instanceof FormData;

    if (!isFormData && body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : (isFormData ? body : JSON.stringify(body)),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Request failed");
    return data;
}