import React, { createContext, useContext, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

// Auth user type
interface AuthUser {
  id: number;
  username: string;
  role: string;
}

// Auth context type
interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: () => boolean;
}

// Create context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => false,
  logout: () => {},
  isAdmin: () => false,
});

// Custom hook to use auth context
export const useAuth = () => useContext(AuthContext);

// Auth provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check for stored auth on mount
  useEffect(() => {
    const checkStoredAuth = () => {
      const storedUser = localStorage.getItem('vfx_user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
        } catch (e) {
          console.error('Failed to parse stored user:', e);
          localStorage.removeItem('vfx_user');
        }
      }
      setIsLoading(false);
    };

    checkStoredAuth();
  }, []);

  // Login function
  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Validate inputs before sending to backend
      if (!username || !password) {
        console.error('Login error: Username and password are required');
        return false;
      }

      console.log(`Attempting login with username: ${username}`);
      
      const result = await invoke<{
        success: boolean;
        user_id?: number;
        username?: string;
        role?: string;
        message: string;
      }>('login', { username, password });

      // Log the result for debugging (without sensitive info)
      console.log(`Login result: success=${result.success}, message=${result.message}`);

      if (result.success && result.user_id && result.username && result.role) {
        const authUser: AuthUser = {
          id: result.user_id,
          username: result.username,
          role: result.role,
        };
        
        setUser(authUser);
        localStorage.setItem('vfx_user', JSON.stringify(authUser));
        return true;
      } else {
        // Log the specific failure reason
        console.warn(`Login failed: ${result.message}`);
        return false;
      }
    } catch (err) {
      // Improved error logging
      if (err instanceof Error) {
        console.error(`Login error: ${err.message}`, err);
      } else {
        console.error('Login error:', err);
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    setUser(null);
    localStorage.removeItem('vfx_user');
  };

  // Check if user is admin
  const isAdmin = () => {
    return user?.role === 'admin';
  };

  // Provide auth context
  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
