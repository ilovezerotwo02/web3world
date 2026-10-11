// =============================================================================
// 安全 API 共用的校验与小工具（服务端）
// =============================================================================

export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_TEXT_LENGTH = 800;

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function isHexAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function isTxHash(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}

export function isCalldata(value: unknown): value is string {
  return typeof value === "string" && /^0x([a-fA-F0-9]{2})*$/.test(value);
}

export function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{1,78}$/.test(value);
}

export function clampText(value: unknown, max = MAX_TEXT_LENGTH): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function parseJsonArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  return [];
}

export async function readJsonBody<T>(request: Request): Promise<T | Response> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return jsonError("请求体过大", 413);
  }
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return jsonError("请求体不是合法 JSON", 400);
  }
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

// ---------------------------------------------------------------------------
// 极简限流（按 isolate 内存计数，用于防止接口被刷）
// ---------------------------------------------------------------------------

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function clientKey(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for") ??
    "local"
  );
}
