import { z } from "zod";
import type {
  Candidate,
  Article,
  EventItem,
  ImageAsset,
  Edition,
} from "../shared/schema";
import { editionSchema } from "../shared/schema";
import { generate } from "./ai";
import { db, type Env } from "./db";
import type { VerifiedEvent } from "./collect";
import { inNewsWindow } from "./collect";
export const selectionSchema = z.object({
  selected: z
    .array(
      z.object({
        id: z.string(),
        eventKey: z.string(),
        score: z.number(),
        reason: z.string(),
        significantChange: z.boolean(),
      }),
    )
    .max(13),
});
const reportSchema = z.object({
  headline: z.string(),
  category: z.string(),
  intro: z.string(),
  paragraphs: z.array(z.string()).min(1).max(8),
  claims: z.array(z.object({ claim: z.string(), evidence: z.string() })).min(1),
});
const verifySchema = z.object({
  supported: z.boolean(),
  naturalPersian: z.boolean(),
  originalReport: z.boolean(),
  problems: z.array(z.string()),
});
export async function imageFor(env: Env, key: string): Promise<ImageAsset> {
  const rows = await db<any[]>(
    env,
    `image_assets?id=eq.${encodeURIComponent(key)}&select=metadata`,
  );
  if (!rows[0]) throw Error("LICENSED_IMAGE_MISSING");
  return rows[0].metadata;
}
export async function selectNews(
  env: Env,
  run: string,
  day: string,
  candidates: Candidate[],
  previous: unknown,
) {
  const result = await generate(
    env,
    run,
    day,
    "selection",
    selectionSchema,
    `Select at most 10 Vancouver and 3 important Canada stories. Prefer last 24h, expand to 72h only for practical relevance. Maximize public impact, timeliness, practical value and topic diversity. Exclude promotions and weak local relevance. Deduplicate underlying events across sources. Return lowercase ASCII eventKey for underlying event. Do not repeat any prior event unless supplied material proves a significant new development. Match prior eventKeys when reporting the same event. All IDs must be exact candidate IDs; score 0-100.`,
    {
      editionDay: day,
      candidates: candidates.map(({ text, ...c }) => ({
        ...c,
        text: text.slice(0, 1800),
      })),
      previous,
    },
    3500,
  );
  const ids = new Set<string>(),
    keys = new Set<string>();
  let local = 0,
    canada = 0;
  return result.selected
    .sort((a, b) => b.score - a.score)
    .filter((s) => {
      const c = candidates.find((c) => c.id === s.id);
      if (
        !c ||
        ids.has(s.id) ||
        keys.has(s.eventKey) ||
        !s.eventKey ||
        !/^[a-z0-9-]{3,160}$/.test(s.eventKey)
      )
        return false;
      if (
        (c.section === "vancouver" && local >= 10) ||
        (c.section === "canada" && canada >= 3)
      )
        return false;
      ids.add(s.id);
      keys.add(s.eventKey);
      c.section === "vancouver" ? local++ : canada++;
      return true;
    });
}
export async function writeArticle(
  env: Env,
  run: string,
  day: string,
  c: Candidate,
) {
  const instructions = `Write an ORIGINAL factual Persian report, never a full translation or close paraphrase. Maximum ${c.maxWords} Persian whitespace-delimited words TOTAL across headline, intro and paragraphs. Usually 2-4 paragraphs, but only when evidence supports it. Intro must not be repeated in paragraphs. No direct quotations. No links. Claims must each carry an exact short English evidence span copied from supplied text; these are private audit data. Do not pad or add unsourced background. Attribute disputed claims explicitly. Numbers/names/dates must be supported. The category must be Persian.`;
  const r = await generate(
    env,
    run,
    day,
    "persian_report",
    reportSchema,
    instructions,
    c,
    2200,
  );
  if (
    r.claims.some((x) => !c.text.includes(x.evidence) || x.evidence.length < 8)
  )
    throw Error("EVIDENCE_SPAN_INVALID");
  const total = [r.headline, r.intro, ...r.paragraphs].join(" ");
  if (
    total.split(/\s+/).length > c.maxWords ||
    !/[\u0600-\u06ff]/.test(total) ||
    /https?:\/\//i.test(total) ||
    r.paragraphs.includes(r.intro)
  )
    throw Error("EDITORIAL_LIMIT");
  const v = await generate(
    env,
    run,
    day,
    "verify_report",
    verifySchema,
    "Independently audit EVERY factual assertion in the complete Persian report against the supplied source. Reject unsupported background, changed numbers, dates, causal claims, certainty, mistranslations or allegations presented as facts. Reject unnatural Persian, padded repetition, close paraphrases or recreation of the complete source. Evidence spans alone do not prove report accuracy. supported=true only if every assertion is supported; originalReport=true only if this is a concise original factual report.",
    { source: c, report: r },
    1200,
  );
  if (
    !v.supported ||
    !v.naturalPersian ||
    !v.originalReport ||
    v.problems.length
  )
    throw Error("EDITORIAL_REVIEW_FAILED");
  return {
    article: {
      id: `${day}-${c.id.slice(0, 18)}`,
      section: c.section,
      category: r.category,
      headline: r.headline,
      intro: r.intro,
      paragraphs: r.paragraphs,
      publishedAt: c.publishedAt,
      sourceName: c.sourceName,
      olderReason:
        Date.now() - Date.parse(c.publishedAt) > 86400000
          ? "این خبر از ۲۴ تا ۷۲ ساعت گذشته، به‌دلیل اهمیت و کاربرد آن انتخاب شده است."
          : "",
      image: await imageFor(env, c.imageKey),
    },
    evidence: { candidate: c, claims: r.claims, review: v },
  };
}
const eventCopy = z.object({
  title: z.string(),
  description: z.string(),
  venue: z.string(),
  address: z.string(),
  scheduleLabel: z.string(),
  priceLabel: z.string(),
});
export async function writeEvent(
  env: Env,
  run: string,
  day: string,
  e: VerifiedEvent,
): Promise<EventItem> {
  const copy = await generate(
    env,
    run,
    day,
    "persian_event",
    eventCopy,
    "Write concise natural Persian from these verified organizer fields only. Preserve exact venue/address and price. For unknown price say «قیمت را از برگزارکننده بررسی کنید». Describe only exact listed occurrences, never imply daily recurrence. Times are America/Vancouver. No invented selling points.",
    e,
    900,
  );
  const review = await generate(
    env,
    run,
    day,
    "verify_event",
    verifySchema,
    "Verify every Persian field against organizer data, especially dates, timezone, recurrence, price, address and venue. Reject all unsupported assertions. naturalPersian and originalReport should reflect concise original factual Persian.",
    { source: e, copy },
    700,
  );
  if (
    !review.supported ||
    !review.naturalPersian ||
    !review.originalReport ||
    review.problems.length
  )
    throw Error("EVENT_REVIEW_FAILED");
  return {
    ...copy,
    id: `${day}-${e.id.slice(0, 18)}`,
    occurrences: e.occurrences,
    bookingUrl: e.url,
    sourceName: e.sourceName,
    image: await imageFor(env, e.imageKey),
  };
}
export function validateEdition(value: unknown, now: Date): Edition {
  const e = editionSchema.parse(value);
  const ids = [...e.articles, ...e.events].map((x) => x.id);
  if (new Set(ids).size !== ids.length) throw Error("DUPLICATE_ID");
  if (
    e.articles.filter((a) => a.section === "vancouver").length > 10 ||
    e.articles.filter((a) => a.section === "canada").length > 3
  )
    throw Error("QUOTA_EXCEEDED");
  for (const a of e.articles) {
    if (!inNewsWindow(a.publishedAt, now)) throw Error("NEWS_DATE_INVALID");
    if (+now - Date.parse(a.publishedAt) > 86400000 && !a.olderReason)
      throw Error("OLDER_REASON_REQUIRED");
  }
  for (const event of e.events)
    for (const o of event.occurrences) {
      if (
        Date.parse(o.end) <= Date.parse(o.start) ||
        Date.parse(o.end) < +now ||
        Date.parse(o.start) > +now + 30 * 86400000
      )
        throw Error("EVENT_DATE_INVALID");
    }
  for (const x of [...e.articles, ...e.events]) {
    const u = new URL(x.image.url);
    if (
      u.protocol !== "https:" ||
      !u.hostname.endsWith(".supabase.co") ||
      !u.pathname.startsWith("/storage/v1/object/public/vanrooz-images/")
    )
      throw Error("IMAGE_NOT_STORED");
  }
  return e;
}
