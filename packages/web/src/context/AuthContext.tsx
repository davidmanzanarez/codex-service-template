import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type AuthUser } from '../api/client';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  loginUrl: string;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginUrl: '',
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth.me().then(({ data }) => {
      if (data?.authenticated && data.user) {
        setUser(data.user);
      }
      setLoading(false);
    });
  }, []);

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginUrl: api.auth.loginUrl(), logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
