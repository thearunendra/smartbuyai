import { API_URL } from "./config";

const TOKEN_KEY = "smartbuyToken";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Storage blocked: the user stays signed in for this page only.
  }
}

// fetch() wrapper: adds the sign-in token and throws with the server's message.
export async function api(path, { method = "GET", body } = {}) {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Something went wrong.");
    error.status = response.status;
    throw error;
  }

  return data;
}
