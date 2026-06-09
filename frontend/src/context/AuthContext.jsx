import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('eventhub_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { localStorage.removeItem('eventhub_user'); }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('eventhub_token', data.accessToken);
    localStorage.setItem('eventhub_refresh', data.refreshToken);
    localStorage.setItem('eventhub_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const register = async (name, email, password, role = 'attendee') => {
    const { data } = await api.post('/auth/register', { name, email, password, role });
    localStorage.setItem('eventhub_token', data.accessToken);
    localStorage.setItem('eventhub_refresh', data.refreshToken);
    localStorage.setItem('eventhub_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('eventhub_token');
    localStorage.removeItem('eventhub_refresh');
    localStorage.removeItem('eventhub_user');
    setUser(null);
  };

  const hasRole = (role) => {
    if (!user?.roles) return false;
    return user.roles.some((r) => (typeof r === 'string' ? r : r?.name) === role);
  };
  const isAdmin = () => hasRole('admin');
  const isOrganiser = () => hasRole('organiser') || hasRole('admin');

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, hasRole, isAdmin, isOrganiser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
