import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import * as authApi from '../api/authApi';
import { getToken, removeToken } from '../api/client';

export interface UserProfile {
  empId: string;
  name: string;
  role: 'Drilling Superintendent' | 'Lead Subsurface Engineer' | 'Real-Time SCADA Operator';
  accessLevel: 'Level 3 - Full Operational Control' | 'Level 2 - Telemetry & Analytics' | 'Level 1 - Read Only';
  rigAssigned: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  login: (empId: string, password: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const DEFAULT_USER_EXTRAS = {
  role: 'Lead Subsurface Engineer' as const,
  accessLevel: 'Level 3 - Full Operational Control' as const,
  rigAssigned: 'Sagar Bhushan (KG-DWN-98/2)',
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: async () => {},
  logout: async () => {},
  isAuthenticated: false,
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('ertmac-auth');
    if (saved && getToken()) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore and verify employee session on initial load
  useEffect(() => {
    async function verifySession() {
      const token = getToken();
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const me = await authApi.getMe();
        const updatedUser: UserProfile = {
          ...DEFAULT_USER_EXTRAS,
          empId: me.employee_id,
          name: me.name || `Employee ${me.employee_id}`,
        };
        setUser(updatedUser);
        localStorage.setItem('ertmac-auth', JSON.stringify(updatedUser));
      } catch {
        // Token invalid or expired
        removeToken();
        localStorage.removeItem('ertmac-auth');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    verifySession();

    // Listen for auth-expired event from API client
    const handleAuthExpired = () => {
      setUser(null);
      localStorage.removeItem('ertmac-auth');
    };
    window.addEventListener('ertmac-auth-expired', handleAuthExpired);

    return () => {
      window.removeEventListener('ertmac-auth-expired', handleAuthExpired);
    };
  }, []);

  const login = async (empId: string, password: string, role?: string) => {
    const response = await authApi.login({
      employee_id: empId.trim(),
      password: password.trim(),
    });

    const userProfile: UserProfile = {
      ...DEFAULT_USER_EXTRAS,
      empId: response.employee_id,
      name: response.name || `Employee ${response.employee_id}`,
      role: (role as UserProfile['role']) || DEFAULT_USER_EXTRAS.role,
    };

    setUser(userProfile);
    localStorage.setItem('ertmac-auth', JSON.stringify(userProfile));
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore network errors on logout
    } finally {
      setUser(null);
      localStorage.removeItem('ertmac-auth');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user && !!getToken(),
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
