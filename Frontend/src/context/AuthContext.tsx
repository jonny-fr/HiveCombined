import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, LoginData, RegisterData } from '../types';
import { login as apiLogin, register as apiRegister, refreshToken as apiRefreshToken } from '../api/auth';
import { getAccessToken, getRefreshToken, clearTokens, getUserInfo, setUserInfo } from '../api/client';

const normalizeUserId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

// Helper function to decode JWT token and extract user info
const decodeToken = (token: string): User | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);

    const normalizedId = normalizeUserId(payload.user_id || payload.id);
    if (normalizedId === null) {
      // Reliability fix: reject malformed token payloads instead of writing invalid IDs into auth state.
      return null;
    }

    return {
      id: normalizedId,
      username: payload.username || payload.name || `User ${normalizedId}`,
      email: payload.email || '',
    };
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Try to restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const user = getUserInfo();

      let accessToken = getAccessToken();

      if (!accessToken) {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          try {
            accessToken = await apiRefreshToken(refreshToken);
          } catch (error) {
            console.error('Failed to refresh token:', error);
            clearTokens();
            setUser(null);
            setIsLoading(false);
            return;
          }
        }
      }

      if (user && accessToken) {
        setUser(user);
      } else if (accessToken) {
        const decodedUser = decodeToken(accessToken);
        if (decodedUser) {
          setUser(decodedUser);
          setUserInfo(decodedUser);
        } else {
          clearTokens();
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    restoreSession();
  }, []);

  const login = async (data: LoginData) => {
    setIsLoading(true);
    try {
      const tokens = await apiLogin(data);
      const user = decodeToken(tokens.access);
      if (user) {
        const normalizedId = normalizeUserId(user.id);
        if (normalizedId === null) {
          throw new Error('Invalid user id in auth token');
        }
        user.id = normalizedId;

        if (!user.username || user.username.startsWith('User ')) {
          user.username = data.username;
        }
        setUser(user);
        setUserInfo(user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      const user = await apiRegister(data);
      const normalizedId = normalizeUserId(user.id);
      if (normalizedId === null) {
        // Reliability fix: fail fast on malformed backend payloads to avoid broken owner checks later.
        throw new Error('Invalid user id in register response');
      }
      user.id = normalizedId;

      setUser(user);
      setUserInfo(user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Export useAuth hook separately to avoid react-refresh issues
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
