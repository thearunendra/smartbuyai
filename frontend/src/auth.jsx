import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // True until the saved token (if any) has been checked with the server.
  const [checking, setChecking] = useState(() => Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;

    let ignore = false;

    api("/api/auth/me")
      .then((data) => {
        if (!ignore) setUser(data.user);
      })
      .catch((error) => {
        // Only a rejected token signs the user out, not a network error.
        if (error.status === 401) setToken(null);
      })
      .finally(() => {
        if (!ignore) setChecking(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const signIn = async (email, password) => {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: { email, password }
    });

    setToken(data.token);
    setUser(data.user);

    return data.user;
  };

  const register = async (name, email, password) => {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: { name, email, password }
    });

    setToken(data.token);
    setUser(data.user);
  };

  const signOut = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, checking, signIn, register, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
