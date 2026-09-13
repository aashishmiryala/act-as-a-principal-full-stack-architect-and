import { create } from "zustand";
import type { Session, User, UserRole } from "@/types";
import { authService } from "@/lib/auth/auth";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  init: () => void;
  signIn: (email: string, password: string) => Promise<boolean>;
  register: (
    email: string,
    password: string,
    fullName: string,
    role?: UserRole,
  ) => Promise<boolean>;
  signOut: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: false,
  error: null,
  initialized: false,

  init: () => {
    const session = authService.restore();
    set({ session, user: session?.user ?? null, initialized: true });
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const session = await authService.signIn(email, password);
      set({ session, user: session.user, loading: false });
      return true;
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      return false;
    }
  },

  register: async (email, password, fullName, role) => {
    set({ loading: true, error: null });
    try {
      const session = await authService.register(email, password, fullName, role);
      set({ session, user: session.user, loading: false });
      return true;
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      return false;
    }
  },

  signOut: () => {
    authService.signOut();
    set({ session: null, user: null });
  },

  clearError: () => set({ error: null }),
}));
