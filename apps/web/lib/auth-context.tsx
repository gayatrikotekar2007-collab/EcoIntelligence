'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  authApi,
  getStoredToken,
  onUnauthorized,
  removeStoredToken,
  setStoredToken,
} from './api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: {
    email: string;
    display_name: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handleSessionInvalidated = useCallback(() => {
    removeStoredToken();
    setUser(null);
    setToken(null);
    setIsLoading(false);
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname !== '/login' && pathname !== '/register' && pathname !== '/') {
        router.replace('/login');
      }
    }
  }, [router]);

  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      handleSessionInvalidated();
    });
    return () => {
      unsubscribe();
    };
  }, [handleSessionInvalidated]);

  const refreshUser = useCallback(async () => {
    const storedToken = getStoredToken();
    if (!storedToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const userData = await authApi.getMe();
      setUser(userData);
      setToken(storedToken);
    } catch {
      handleSessionInvalidated();
    } finally {
      setIsLoading(false);
    }
  }, [handleSessionInvalidated]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (payload: { email: string; password: string }) => {
    const res = await authApi.login(payload);
    setStoredToken(res.access_token);
    setToken(res.access_token);
    setUser(res.user);
  };

  const register = async (payload: {
    email: string;
    display_name: string;
    password: string;
  }) => {
    const res = await authApi.register(payload);
    setStoredToken(res.access_token);
    setToken(res.access_token);
    setUser(res.user);
  };

  const logout = async () => {
    await authApi.logout();
    removeStoredToken();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
