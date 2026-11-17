import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('civicfix_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.data.user);
      setTenant(data.data.tenant);
    } catch {
      localStorage.removeItem('civicfix_token');
      setUser(null);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const saveSession = (data) => {
    localStorage.setItem('civicfix_token', data.token);
    setUser(data.user);
    setTenant(data.tenant);
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    saveSession(data.data);
  };

  const register = async (organizationName, name, email, password) => {
    const { data } = await api.post('/auth/register', { organizationName, name, email, password });
    saveSession(data.data);
  };

  const logout = () => {
    localStorage.removeItem('civicfix_token');
    setUser(null);
    setTenant(null);
  };

  const value = useMemo(() => ({
    user,
    tenant,
    loading,
    login,
    register,
    logout,
    refreshUser: fetchCurrentUser,
    isSuperAdmin: user?.role === 'superadmin',
    isOwner: user?.role === 'owner',
    isManager: ['superadmin', 'owner', 'manager'].includes(user?.role),
    isWorker: user?.role === 'worker',
    isResident: user?.role === 'resident'
  }), [user, tenant, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
