import { type Session } from "@agentic/auth";

export function getSession(): Session | null {
  // In production, this reads from NextAuth/Clerk session
  // For MVP, we derive from the auth provider
  try {
    const raw = process.env.NEXT_PUBLIC_MOCK_SESSION;
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function requireSession(): Session {
  const session = getSession();
  if (!session) throw new Error("Authentication required");
  return session;
}

export function getTenantId(): string {
  return requireSession().tenantId;
}
