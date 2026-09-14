import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  quickDemoLogin: () => void;
}

const DEFAULT_TEACHER: User = {
  id: 'usr_teacher_yunus',
  name: 'Yunus Emre Yılmaz',
  email: 'yunusemreyilmaz93@gmail.com',
  title: 'Arapça YDT & YDS Koordinatörü',
  institution: 'Anadolu İHL & YDT Akademisi',
  role: 'teacher',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('arabic_ydt_auth_user');
      if (stored) {
        setUser(JSON.parse(stored));
      } else {
        // Automatically start with default logged-in teacher for seamless internal tool workflow
        setUser(DEFAULT_TEACHER);
        localStorage.setItem('arabic_ydt_auth_user', JSON.stringify(DEFAULT_TEACHER));
      }
    } catch (e) {
      console.error('Failed to parse auth user', e);
      setUser(DEFAULT_TEACHER);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Simulated internal teacher credential check
    if (!email || !password) {
      return { success: false, error: 'Lütfen kullanıcı adı / e-posta ve şifrenizi giriniz.' };
    }

    if (password.length < 4) {
      return { success: false, error: 'Şifre en az 4 karakter olmalıdır.' };
    }

    const teacherUser: User = {
      id: `usr_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name: email.includes('@') ? email.split('@')[0].replace('.', ' ').toUpperCase() : email,
      email: email.includes('@') ? email : `${email}@ydtakademi.edu.tr`,
      title: 'Arapça YDT Zümre Başkanı',
      institution: 'YDT Soru Hazırlama & Video Birimi',
      role: 'teacher',
    };

    setUser(teacherUser);
    localStorage.setItem('arabic_ydt_auth_user', JSON.stringify(teacherUser));
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('arabic_ydt_auth_user');
  };

  const quickDemoLogin = () => {
    setUser(DEFAULT_TEACHER);
    localStorage.setItem('arabic_ydt_auth_user', JSON.stringify(DEFAULT_TEACHER));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        quickDemoLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
