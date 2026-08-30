import { clearSessionCookie } from "../../../../../src/operations/session-helper";
export async function POST() { const response = Response.json({ ok: true, data: { authenticated: false }, meta: { source: "adapter-fallback" } }); response.headers.set("Set-Cookie", clearSessionCookie()); response.headers.set("Cache-Control", "no-store, private"); return response; }
export const runtime = "nodejs";
