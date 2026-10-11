// 钱包签名后获得的会话 token 只保存在浏览器本地，用于安全模块同步关键结果到 D1。
// 注意：这里不会保存任何私钥 / 助记词，token 也只在服务端校验。

export const SESSION_STORAGE_KEY = "monad-pixel-farm:v35:session-token";

export function readSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeSessionToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, token);
  } catch {
    // ignore storage failures
  }
}

export function clearSessionToken() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}
