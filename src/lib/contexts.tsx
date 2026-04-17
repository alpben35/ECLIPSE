import { createContext } from 'react';
import { User } from 'firebase/auth';

export const ThemeContext = createContext<{
  isDark: boolean;
  toggleTheme: () => void;
}>({ isDark: false, toggleTheme: () => {} });

export const AuthContext = createContext<{
  user: User | null;
  profile: any | null;
  loading: boolean;
  addXp: (amount: number) => Promise<void>;
  isOwner: boolean;
  isAdmin: boolean;
  maintenance: boolean;
}>({ 
  user: null, 
  profile: null, 
  loading: true, 
  addXp: async () => {}, 
  isOwner: false, 
  isAdmin: false,
  maintenance: false 
});
