/**
 * Authentication service — Supabase Auth (with a resilient local fallback).
 * ------------------------------------------------------------------
 * End-users sign in / register against Supabase Auth. A profile row is created
 * automatically by the `handle_new_user` trigger and read back to hydrate the
 * app's `User`. If the network/Supabase is unreachable (e.g. the fully offline
 * single-file preview) the seeded demo accounts still work via a local session
 * so the console is always explorable.
 */

import type { Session, User, UserRole } from "@/types";
import { uid } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import type {
  Session as SbSession,
  User as SbUser,
} from "@supabase/supabase-js";

const SESSION_KEY = "healthguard.session.v1"; // local fallback session only

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "#f472b6",
  clinician: "#22d3ee",
  caregiver: "#a78bfa",
  patient: "#34d399",
};

interface DemoUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarColor: string;
}

const DEMO_USERS: DemoUser[] = [
  { id: "usr_admin", email: "admin@healthguard.io", fullName: "Dr. Ada Reeves", role: "admin", avatarColor: ROLE_COLORS.admin },
  { id: "usr_clinician", email: "clinician@healthguard.io", fullName: "Dr. Noah Bennett", role: "clinician", avatarColor: ROLE_COLORS.clinician },
  { id: "usr_caregiver", email: "caregiver@healthguard.io", fullName: "Maria Santos", role: "caregiver", avatarColor: ROLE_COLORS.caregiver },
];

const DEMO_PASSWORD = "healthguard";

function friendlyError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err);
  if (/invalid login credentials/i.test(msg)) return "Invalid email or password.";
  if (/already registered|already exists|user already/i.test(msg))
    return "An account with that email already exists.";
  if (/email.*confirm/i.test(msg)) return "Please confirm your email, then sign in.";
  return msg || "Authentication failed.";
}

async function profileToUser(sb: SbUser): Promise<User> {
  const meta = (sb.user_metadata ?? {}) as Record<string, string>;
  let role = (meta.role as UserRole) ?? "clinician";
  let fullName = meta.full_name ?? sb.email?.split("@")[0] ?? "User";
  let avatarColor = meta.avatar_color ?? ROLE_COLORS[role] ?? "#22d3ee";
  let createdAt = sb.created_at ? new Date(sb.created_at).getTime() : Date.now();

  try {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, role, avatar_color, created_at")
      .eq("id", sb.id)
      .maybeSingle();
    if (data) {
      role = (data.role as UserRole) ?? role;
      fullName = data.full_name || fullName;
      avatarColor = data.avatar_color || avatarColor;
      createdAt = data.created_at ? new Date(data.created_at).getTime() : createdAt;
    }
  } catch {
    /* profile read failed — fall back to auth metadata */
  }

  return { id: sb.id, email: sb.email ?? "", fullName, role, avatarColor, createdAt };
}

function toSession(sb: SbSession, user: User): Session {
  return {
    token: sb.access_token,
    user,
    issuedAt: Date.now(),
    expiresAt: sb.expires_at ? sb.expires_at * 1000 : Date.now() + 3600_000,
  };
}

function localSession(demo: DemoUser): Session {
  const user: User = {
    id: demo.id,
    email: demo.email,
    fullName: demo.fullName,
    role: demo.role,
    avatarColor: demo.avatarColor,
    createdAt: Date.now(),
  };
  const session: Session = {
    token: uid("local"),
    user,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 12 * 3600_000,
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* non-fatal */
  }
  return session;
}

export const authService = {
  demoCredentials: DEMO_USERS.map((u) => ({ email: u.email, role: u.role })),

  async signIn(email: string, password: string): Promise<Session> {
    const em = email.trim().toLowerCase();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: em, password });
      if (error) throw error;
      if (!data.session || !data.user) throw new Error("Sign-in failed.");
      const user = await profileToUser(data.user);
      return toSession(data.session, user);
    } catch (err) {
      // Offline / unreachable → let the seeded demo accounts through locally.
      const demo = DEMO_USERS.find((d) => d.email === em);
      if (demo && password === DEMO_PASSWORD) return localSession(demo);
      throw new Error(friendlyError(err));
    }
  },

  async register(
    email: string,
    password: string,
    fullName: string,
    role: UserRole = "clinician",
  ): Promise<Session> {
    const em = email.trim().toLowerCase();
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
    try {
      const { data, error } = await supabase.auth.signUp({
        email: em,
        password,
        options: {
          data: {
            full_name: fullName.trim() || em.split("@")[0],
            role,
            avatar_color: ROLE_COLORS[role],
          },
        },
      });
      if (error) throw error;
      if (data.session && data.user) {
        const user = await profileToUser(data.user);
        return toSession(data.session, user);
      }
      // Session not returned (e.g. confirmation flow) — attempt an immediate sign-in.
      return await this.signIn(em, password);
    } catch (err) {
      throw new Error(friendlyError(err));
    }
  },

  async restore(): Promise<Session | null> {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const user = await profileToUser(data.session.user);
        return toSession(data.session, user);
      }
    } catch {
      /* fall back to any local demo session */
    }
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw) as Session;
        if (session.expiresAt > Date.now()) return session;
      }
    } catch {
      /* ignore */
    }
    return null;
  },

  signOut(): void {
    try {
      void supabase.auth.signOut();
    } catch {
      /* non-fatal */
    }
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* non-fatal */
    }
  },
};
