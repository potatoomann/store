import { NextResponse } from "next/server";
import crypto from "crypto";

// Simple in-memory rate limiter per IP+route (best-effort; replace with Redis in prod)
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX = 60; // 60 requests/minute
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number = RATE_MAX, windowMs: number = RATE_WINDOW_MS) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (entry.count >= max) {
    return { allowed: false, retryAfter: Math.max(0, entry.resetAt - now) } as const;
  }
  entry.count += 1;
  return { allowed: true } as const;
}

// JSON helpers
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<T>(data, { status: 200, ...(init || {}) });
}

export function created<T>(data: T) {
  return NextResponse.json<T>(data, { status: 201 });
}

export function badRequest(message = "Bad Request", details?: unknown) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status: 400 });
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Not Found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = "Internal server error", details?: unknown) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status: 500 });
}

// Minimal auth guard hooks (to be replaced with your real auth/session)
export type UserRole = "USER" | "ADMIN";
export type Session = { userId: string; role?: UserRole } | null;

export async function getSession(req: Request): Promise<Session> {
  // Placeholder: read from cookie/header if present
  const header = req.headers.get("x-user-id");
  const roleHeader = req.headers.get("x-user-role");
  const role: UserRole | undefined = roleHeader === "ADMIN" ? "ADMIN" : roleHeader === "USER" ? "USER" : undefined;
  if (!header) return null;
  return { userId: header, role: role ?? "USER" };
}

export async function requireAdmin(req: Request) {
  const session = await getSession(req);
  if (!session) return unauthorized("Authentication required");
  if (session.role !== "ADMIN") return forbidden("Admin only");
  return null; // ok
}

// Password reset token helpers
export function generateOpaqueToken(size = 32) {
  return crypto.randomBytes(size).toString("hex");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
