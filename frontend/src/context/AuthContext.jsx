import { createContext, useContext, useEffect, useState } from 'react';
import { api, clearToken, getToken, setToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const beat = () => {
      api('/auth/presence', { method: 'POST', body: '{}' }).catch(() => {});
    };
    beat();
    const id = setInterval(beat, 60000);
    return () => clearInterval(id);
  }, [user?.id]);

  async function login(email, password) {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(name, email, password, extras = {}) {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, ...extras }),
    });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
