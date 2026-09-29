import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { db, rpc, upsert, type Env } from "./db";
import { due, localDay, validDay, shiftDay } from "../shared/date";
import { sources } from "./sources";
import { z } from "zod";
import { generate } from "./ai";
import { collectNews, collectEvents, type VerifiedEvent } from "./collect";
import {
  selectNews,
  writeArticle,
  writeEvent,
  validateEdition,
} from "./editor";
import type { Candidate, Article, EventItem } from "../shared/schema";
const RETRY = {
  retries: {
    limit: 2,
    delay: "10 seconds" as const,
    backoff: "exponential" as const,
  },
  timeout: "5 minutes" as const,
};
const AI_ONCE = {
  retries: { limit: 0, delay: "1 second" as const },
  timeout: "5 minutes" as const,
};
export class DailyEdition extends WorkflowEntrypoint<Env, { day: string }> {
  async run(event: WorkflowEvent<{ day: string }>, step: WorkflowStep) {
    const run = event.instanceId,
      day = event.payload.day;
    if (this.env.UPDATES_PAUSED === "true") return { paused: true };
    if (!validDay(day) || day !== localDay(event.timestamp))
      throw Error("INVALID_RUN_DATE");
    const claimed = await step.do("claim job", RETRY, () =>
      rpc<boolean>(this.env, "claim_run", { p_id: run, p_day: day }),
    );
    if (!claimed) return { skipped: true };
    try {
      await step.do("verify model and configuration", RETRY, async () => {
        if (this.env.PRICING_MODEL !== this.env.OPENAI_MODEL)
          throw Error("PRICING_NOT_VERIFIED");
        const r = await fetch(
          `https://api.openai.com/v1/models/${encodeURIComponent(this.env.OPENAI_MODEL)}`,
          {
            headers: { Authorization: `Bearer ${this.env.OPENAI_API_KEY}` },
            signal: AbortSignal.timeout(20000),
          },
        );
        if (!r.ok) throw Error("MODEL_UNAVAILABLE");
        return true;
      });
      const candidates: Candidate[] = [],
        events: VerifiedEvent[] = [],
        health: { id: string; ok: boolean; count: number }[] = [];
      for (const source of sources.filter(
        (s) => s.enabled && s.rightsReviewed,
      )) {
        const result = await step.do(
          `collect ${source.id}`,
          RETRY,
          async () => {
            await upsert(this.env, "sources", {
              id: source.id,
              config: source,
              checked_at: new Date().toISOString(),
            });
            try {
              return {
                ok: true,
                news:
                  source.kind === "rss"
                    ? await collectNews(source, event.timestamp)
                    : [],
                events:
                  source.kind === "events"
                    ? await collectEvents(source, event.timestamp)
                    : [],
              };
            } catch {
              return { ok: false, news: [], events: [] };
            }
          },
        );
        candidates.push(...result.news);
        events.push(...result.events);
        health.push({
          id: source.id,
          ok: result.ok,
          count: result.news.length + result.events.length,
        });
      }
      if (!candidates.length) throw Error("NO_VERIFIED_NEWS");
      const previous = await step.do("load prior coverage", RETRY, () =>
        db<any[]>(
          this.env,
          `processed?published_day=gte.${shiftDay(day, -7)}&select=id,hash,event_key,published_day,facts`,
        ),
      );
      const fresh = candidates.filter(
        (c) => !previous.some((p) => p.id === c.id && p.hash === c.hash),
      );
      if (!fresh.length) throw Error("NO_NEW_NEWS");
      const selected = await step.do("rank and deduplicate", AI_ONCE, () =>
        selectNews(this.env, run, day, fresh, previous),
      );
      const news: Article[] = [],
        evidence: unknown[] = [],
        processed: any[] = [];
      for (const selection of selected) {
        if (
          previous.some((p) => p.event_key === selection.eventKey) &&
          !selection.significantChange
        )
          continue;
        const c = fresh.find((c) => c.id === selection.id)!;
        const report = await step.do(
          `write and verify ${c.id.slice(0, 20)}`,
          AI_ONCE,
          () => writeArticle(this.env, run, day, c),
        );
        news.push(report.article);
        evidence.push(report.evidence);
        processed.push({
          id: c.id,
          hash: c.hash,
          event_key: selection.eventKey,
          facts: c.title + "\n" + c.text.slice(0, 5000),
        });
      }
      const publishedEvents: EventItem[] = [];
      // Explicit, verified occurrences; duplicate event URLs are collapsed.
      const grouped = new Map<string, VerifiedEvent>();
      for (const e of events) {
        const old = grouped.get(e.url);
        if (old) {
          old.occurrences.push(
            ...e.occurrences.filter(
              (o) => !old.occurrences.some((x) => x.start === o.start),
            ),
          );
        } else grouped.set(e.url, { ...e, occurrences: [...e.occurrences] });
      }
      const options = [...grouped.values()];
      const ranked = options.length
        ? await step.do("select worthwhile events", AI_ONCE, () =>
            generate(
              this.env,
              run,
              day,
              "select_events",
              z.object({ ids: z.array(z.string()).max(6) }),
              "Select up to six worthwhile Vancouver events from exact candidate IDs. Prefer a useful mix of culture, community, family, affordability and near-term availability. Never invent or alter schedules. Select fewer when quality is low.",
              options.map(({ text, ...e }) => ({
                ...e,
                text: text.slice(0, 700),
              })),
              700,
            ),
          )
        : { ids: [] };
      const uniqueEvents = [...new Set(ranked.ids)]
        .map((id) => options.find((e) => e.id === id))
        .filter((e): e is VerifiedEvent => !!e);
      for (const e of uniqueEvents) {
        publishedEvents.push(
          await step.do(`event ${e.id.slice(0, 20)}`, AI_ONCE, () =>
            writeEvent(this.env, run, day, e),
          ),
        );
        evidence.push({ event: e });
      }
      const local = news.filter((a) => a.section === "vancouver").length,
        canada = news.filter((a) => a.section === "canada").length;
      const note = [
        local < 10
          ? `در این نسخه ${local.toLocaleString("fa-IR")} خبر ونکوور انتخاب شد؛ خبر قابل تأیید و مرتبط بیشتری در بازهٔ بررسی موجود نبود.`
          : "",
        canada < 2
          ? "تعداد خبرهای کانادا کمتر از هدف روزانه است؛ برای تکمیل تعداد، خبر تأییدنشده اضافه نشده است."
          : "",
        publishedEvents.length < 3
          ? "رویدادهای کمتری با زمان و جزئیات قابل تأیید در دسترس بود."
          : "",
        health.some((h) => !h.ok)
          ? "برخی منابع هنگام تهیهٔ این نسخه در دسترس نبودند."
          : "",
      ]
        .filter(Boolean)
        .join(" ");
      const edition = validateEdition(
        {
          date: day,
          publishedAt: new Date().toISOString(),
          note,
          articles: news,
          events: publishedEvents,
        },
        event.timestamp,
      );
      const published = await step.do("atomic publication", RETRY, () =>
        rpc<boolean>(this.env, "publish_edition", {
          p_run: run,
          p_day: day,
          p_payload: edition,
          p_evidence: evidence,
          p_processed: processed,
        }),
      );
      await step.do("record metrics", RETRY, () =>
        db(this.env, `runs?id=eq.${encodeURIComponent(run)}`, {
          method: "PATCH",
          body: JSON.stringify({
            metrics: {
              sources: health,
              collected: candidates.length,
              selected: news.length,
              events: publishedEvents.length,
              searchCalls: 0,
            },
          }),
        }),
      );
      return { published, day };
    } catch (error) {
      const code =
        error instanceof Error && /^[A-Z_0-9]+$/.test(error.message)
          ? error.message
          : "UPDATE_FAILED";
      await step.do("record failure", RETRY, () =>
        rpc(this.env, "fail_run", { p_run: run, p_code: code }),
      );
      throw Error(code);
    }
  }
}
async function owner(request: Request, env: Env) {
  if (!env.OWNER_TOKEN || env.OWNER_TOKEN.length < 32) return false;
  const input = request.headers.get("Authorization") || "";
  const enc = new TextEncoder();
  const a = await crypto.subtle.digest("SHA-256", enc.encode(input)),
    b = await crypto.subtle.digest(
      "SHA-256",
      enc.encode(`Bearer ${env.OWNER_TOKEN}`),
    );
  let diff = 0;
  const aa = new Uint8Array(a),
    bb = new Uint8Array(b);
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}
const json = (x: unknown, status = 200) =>
  Response.json(x, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
export default {
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const now = new Date(event.scheduledTime);
    if (env.UPDATES_PAUSED === "true" || !due(now)) return;
    const day = localDay(now);
    ctx.waitUntil(
      env.DAILY.create({ id: `edition-${day}`, params: { day } }).catch(
        async () => {
          const instance = await env.DAILY.get(`edition-${day}`);
          const status = await instance.status();
          if (status.status === "errored")
            console.error("DAILY_REQUIRES_OWNER_RERUN");
        },
      ),
    );
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/health")
        return json({
          service: "vanrooz",
          configured: !!env.SUPABASE_URL,
          databaseReadConfigured: !!env.SUPABASE_URL && !!env.SUPABASE_PUBLISHABLE_KEY,
          updatesPaused: env.UPDATES_PAUSED === "true",
        });
      if (url.pathname.startsWith("/api/admin/")) {
        if (!(await owner(request, env)))
          return json({ error: "UNAUTHORIZED" }, 401);
        if (url.pathname === "/api/admin/status" && request.method === "GET")
          return json({
            runs: await db(env, "runs?order=started_at.desc&limit=15"),
            usage: await db(
              env,
              `usage_ledger?day=gte.${localDay().slice(0, 7)}-01&select=day,model,reserved_usd,actual_usd,input_tokens,output_tokens,state`,
            ),
          });
        if (url.pathname === "/api/admin/run" && request.method === "POST") {
          if (env.UPDATES_PAUSED === "true")
            return json({ error: "UPDATES_PAUSED" }, 409);
          const day = localDay();
          const existing = await db<any[]>(
            env,
            `editions?day=eq.${day}&select=day`,
            {},
            false,
          );
          if (existing.length)
            return json({ status: "already_published", day });
          const id = `manual-${day}-${crypto.randomUUID()}`;
          await env.DAILY.create({ id, params: { day } });
          return json({ id, day }, 202);
        }
        return json({ error: "NOT_FOUND" }, 404);
      }
      if (
        url.pathname.startsWith("/api/editions/") &&
        request.method === "GET"
      ) {
        const day = url.pathname.split("/").pop()!;
        if (!validDay(day)) return json({ error: "INVALID_DATE" }, 400);
        if (!env.SUPABASE_URL)
          return json({
            edition: null,
            dates: [],
            latest: null,
            status: "unconfigured",
          });
        const [rows, calendar, latest] = await Promise.all([
          db<any[]>(env, `editions?day=eq.${day}&select=payload`, {}, false),
          db<any[]>(
            env,
            `editions?day=gte.${shiftDay(localDay(), -9)}&day=lte.${localDay()}&select=day&order=day.desc`,
            {},
            false,
          ),
          db<any[]>(
            env,
            "editions?select=day&order=day.desc&limit=1",
            {},
            false,
          ),
        ]);
        let state = "missing";
        if (rows.length) state = "published";
        else {
          const runs = await db<any[]>(
            env,
            `runs?day=eq.${day}&select=state&order=started_at.desc&limit=1`,
          );
          state = runs[0]?.state || "missing";
        }
        return json({
          edition: rows[0]?.payload || null,
          dates: calendar.map((x) => x.day),
          latest: latest[0]?.day || null,
          status: state,
        });
      }
      if (url.pathname.startsWith("/api/"))
        return json({ error: "NOT_FOUND" }, 404);
      return env.ASSETS.fetch(request);
    } catch (error) {
      const safeCode =
        error instanceof Error &&
        /^(DATABASE_HTTP_[0-9]{3}|DATABASE_UNCONFIGURED)$/.test(error.message)
          ? error.message
          : "INTERNAL_ERROR";
      console.error("PUBLIC_API_FAILURE", safeCode);
      return json({ error: "SERVICE_UNAVAILABLE" }, 503);
    }
  },
} satisfies ExportedHandler<Env>;
