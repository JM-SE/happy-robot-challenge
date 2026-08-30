import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getAdapterSecret, isAdapterAuthorized } from "../tms/http-auth";
export function authorizeAdapter(value: string | null): boolean { return isAdapterAuthorized(value); }
export function hasUiSecret(env: NodeJS.ProcessEnv = process.env): boolean { return Boolean(env.OPERATIONS_UI_SECRET?.trim()); }
export function uiSecret(env: NodeJS.ProcessEnv = process.env): string | undefined { const value = env.OPERATIONS_UI_SECRET; return value?.trim() ? value : undefined; }
export function verifyUiSecret(candidate: string, env: NodeJS.ProcessEnv = process.env): boolean { const secret = uiSecret(env); if (!secret) return false; const expected = createHmac("sha256", "operations-ui-comparison").update(secret).digest(); const provided = createHmac("sha256", "operations-ui-comparison").update(candidate).digest(); return timingSafeEqual(expected, provided); }
export { getAdapterSecret };
