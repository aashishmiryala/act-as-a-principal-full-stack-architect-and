/**
 * Authentication service (client-side).
 * ------------------------------------------------------------------
 * Provides email/password sign-in + registration with role-based sessions,
 * persisted to localStorage. This is the exact surface the app would use against
 * Supabase Auth — swap these methods for `supabase.auth.signInWithPassword(...)`
 * etc. and the rest of the app is unchanged. Demo credentials are seeded so the
 * preview build is immediately explorable.
 */

import type { Session, User, UserRole } from "@/types";
import { uid } from "@/lib/utils";

const SESSION_KEY = "healthguard.session.v1";
const USERS_KEY = "healthguard.users.v1";
const SESSION_TTL = 1000 * 60 * 60 * 12; // 12h

interface StoredUser extends User {
  password: string;
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "#f472b6",
  clinician: "#22d3ee",
  caregiver: "#a78bfa",
  patient: "#34d399",
};

const DEMO_USERS: StoredUser[] = [
  {
    id: "usr_admin",
    email: "admin@healthguard.io",
    password: "healthguard",
    fullName: "Dr. Ada Reeves",
    role: "admin",
    avatarColor: ROLE_COLORS.admin,
    createdAt: Date.now(),
  },
  {
    id: "usr_clinician",
    email: "clinician@healthguard.io",
    password: "healthguard",
    fullName: "Dr. Noah Bennett",
    role: "clinician",
    avatarColor: ROLE_COLORS.clinician,
    createdAt: Date.now(),
  },
  {
    id: "usr_caregiver",
    email: "caregiver@healthguard.io",
    password: "healthguard",
    fullName: "Maria Santos",
    role: "caregiver",
    avatarColor: ROLE_COLORS.caregiver,
    createdAt: Date.now(),
  },
];

function loadUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredUser[];
      // Ensure demo users always exist.
      const emails = new Set(parsed.map((u) => u.email));
      for (const d of DEMO_USERS) if (!emails.has(d.email)) parsed.push(d);
      return parsed;
    }
  } catch {
    /* fall through to seed */
  }
  persistUsers(DEMO_USERS);
  return [...DEMO_USERS];
}

function persistUsers(users: StoredUser[]): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    /* non-fatal */
  }
}

function toPublic(u: StoredUser): User {
  const { password: _pw, ...pub } = u;
  void _pw;
  return pub;
}

export const authService = {
  demoCredentials: DEMO_USERS.map((u) => ({ email: u.email, role: u.role })),

  async signIn(email: string, password: string): Promise<Session> {
    await delay(320);
    const users = loadUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!user || user.password !== password) {
      throw new Error("Invalid email or password.");
    }
    return this.issueSession(toPublic(user));
  },

  async register(
    email: string,
    password: string,
    fullName: string,
    role: UserRole = "clinician",
  ): Promise<Session> {
    await delay(360);
    const users = loadUsers();
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase().trim())) {
      throw new Error("An account with that email already exists.");
    }
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
    const user: StoredUser = {
      id: uid("usr"),
      email: email.trim(),
      password,
      fullName: fullName.trim() || email.split("@")[0],
      role,
      avatarColor: ROLE_COLORS[role],
      createdAt: Date.now(),
    };
    users.push(user);
    persistUsers(users);
    return this.issueSession(toPublic(user));
  },

  issueSession(user: User): Session {
    const session: Session = {
      token: uid("tok"),
      user,
      issuedAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL,
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* non-fatal */
    }
    return session;
  },

  restore(): Session | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as Session;
      if (session.expiresAt < Date.now()) {
        this.signOut();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  signOut(): void {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* non-fatal */
    }
  },
};

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
