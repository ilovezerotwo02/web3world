import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export { schema };

export function getDb() {
  // In the Cloudflare Workers runtime, `env.DB` is injected by the platform.
  // The `cloudflare:workers` module is only available at runtime, not for type checking.
  // We use `process.env` as a fallback for type safety in non-Workers contexts.
  //
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (globalThis as any).env ?? {};
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database.",
    );
  }

  return drizzle(env.DB as D1Database, { schema });
}

export type DB = ReturnType<typeof getDb>;
