export interface Env {
  ASSETS: Fetcher;
  DAILY: Workflow<{ day: string }>;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  OPENAI_API_KEY: string;
  OWNER_TOKEN: string;
  OPENAI_MODEL: string;
  PRICING_MODEL: string;
  INPUT_USD_PER_MILLION: string;
  OUTPUT_USD_PER_MILLION: string;
  MONTHLY_BUDGET_USD: string;
  DAILY_BUDGET_USD: string;
  UPDATES_PAUSED: string;
}
export async function db<T = any>(
  env: Env,
  path: string,
  options: RequestInit = {},
  privileged = true,
): Promise<T> {
  if (
    !env.SUPABASE_URL ||
    !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.SUPABASE_URL)
  )
    throw Error("DATABASE_UNCONFIGURED");
  const key = privileged
    ? env.SUPABASE_SECRET_KEY
    : env.SUPABASE_PUBLISHABLE_KEY;
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    signal: AbortSignal.timeout(20000),
    headers: {
      apikey: key,
      ...(key?.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!r.ok) throw Error(`DATABASE_HTTP_${r.status}`);
  const t = await r.text();
  return (t ? JSON.parse(t) : null) as T;
}
export const rpc = <T = any>(env: Env, name: string, args: unknown) =>
  db<T>(env, `rpc/${name}`, { method: "POST", body: JSON.stringify(args) });
export const upsert = (env: Env, table: string, row: unknown) =>
  db(env, table, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(row),
  });
export async function hash(s: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
