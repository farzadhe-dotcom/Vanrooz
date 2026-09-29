import { XMLParser } from "fast-xml-parser";
import { load } from "cheerio";
import type { Candidate, Source } from "../shared/schema";
import { safeFetch, approvedUrl } from "./fetch";
import { hash } from "./db";
export const plain = (s: string) => load(s).text().replace(/\s+/g, " ").trim();
const arr = (x: any): any[] =>
  x === undefined ? [] : Array.isArray(x) ? x : [x];
export function parseFeed(
  xml: string,
): { title: string; url: string; date: string; text: string }[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw Error("XML_ENTITIES_FORBIDDEN");
  const data = new XMLParser({
    ignoreAttributes: false,
    processEntities: false,
    removeNSPrefix: false,
  }).parse(xml);
  return arr(data.rss?.channel?.item || data.feed?.entry).map((x) => ({
    title: plain(String(x.title?.["#text"] || x.title || "")),
    url:
      typeof x.link === "string"
        ? x.link
        : arr(x.link).find((l) => l["@_rel"] === "alternate" || !l["@_rel"])?.[
            "@_href"
          ] || "",
    date: x.pubDate || x.published || x.updated || "",
    text: plain(
      String(
        x["content:encoded"] ||
          x.content?.["#text"] ||
          x.content ||
          x.description ||
          x.summary?.["#text"] ||
          x.summary ||
          "",
      ),
    ),
  }));
}
export function inNewsWindow(iso: string, now: Date) {
  const t = Date.parse(iso);
  return Number.isFinite(t) && t <= +now && t >= +now - 72 * 3600000;
}
export async function collectNews(s: Source, now: Date): Promise<Candidate[]> {
  if (!s.enabled || !s.rightsReviewed) return [];
  const feed = await safeFetch(s.url, s.hosts);
  const results: Candidate[] = [];
  for (const item of parseFeed(feed.body)
    .filter((i) => inNewsWindow(i.date, now))
    .slice(0, 16)) {
    try {
      const url = approvedUrl(item.url, s.hosts).href;
      const page = await safeFetch(url, s.hosts);
      if (!page.type.includes("html")) continue;
      const $ = load(page.body);
      $("script,style,nav,footer,header,form,aside").remove();
      let body = $(s.selector || "article .entry-content,article,main")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim();
      if (body.length < 120) body = item.text;
      if (body.length < 120) continue;
      // Limit source material; never infer full text from a feed summary.
      const text = body.slice(0, 14000),
        id = await hash(url),
        contentHash = await hash(text);
      results.push({
        id,
        sourceId: s.id,
        sourceName: s.name,
        url,
        title: item.title,
        publishedAt: new Date(item.date).toISOString(),
        text,
        hash: contentHash,
        section: s.section,
        maxWords: s.maxWords,
        imageKey: s.imageKey,
      });
    } catch {
      /* Candidate inaccessible: exclude, do not invent. */
    }
  }
  return results;
}
export interface VerifiedEvent {
  id: string;
  sourceId: string;
  sourceName: string;
  url: string;
  title: string;
  text: string;
  venue: string;
  address: string;
  occurrences: { start: string; end: string }[];
  price: string;
  imageKey: string;
}
function objects(x: any): any[] {
  if (Array.isArray(x)) return x.flatMap(objects);
  if (!x || typeof x !== "object") return [];
  return [x, ...Object.values(x).flatMap(objects)];
}
export function parseEvents(
  html: string,
  url: string,
  s: Source,
  now: Date,
): VerifiedEvent[] {
  const $ = load(html);
  let data: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      data.push(...objects(JSON.parse($(el).text())));
    } catch {}
  });
  const out: VerifiedEvent[] = [];
  for (const x of data) {
    if (!arr(x["@type"]).includes("Event")) continue;
    if (
      x.eventSchedule ||
      (x.eventStatus && x.eventStatus !== "https://schema.org/EventScheduled")
    )
      continue; // Never pretend an unexpanded recurrence runs daily.
    const start = x.startDate,
      end = x.endDate;
    if (
      typeof start !== "string" ||
      typeof end !== "string" ||
      !/(Z|[+-]\d\d:\d\d)$/.test(start) ||
      !/(Z|[+-]\d\d:\d\d)$/.test(end)
    )
      continue;
    if (
      !Number.isFinite(Date.parse(start)) ||
      !Number.isFinite(Date.parse(end)) ||
      +new Date(end) < +now ||
      +new Date(start) > +now + 30 * 86400000 ||
      +new Date(end) <= +new Date(start)
    )
      continue;
    // Multi-day festival range alone is not a verified daily schedule.
    if (+new Date(end) - +new Date(start) > 24 * 3600000) continue;
    const loc = x.location;
    if (!loc || typeof loc.name !== "string") continue;
    const address =
      typeof loc.address === "string"
        ? loc.address
        : [loc.address?.streetAddress, loc.address?.addressLocality]
            .filter(Boolean)
            .join(", ");
    if (
      !address ||
      !/Vancouver|Burnaby|Richmond|Surrey|Coquitlam|New Westminster|Delta|Langley|Maple Ridge|North Vancouver|West Vancouver/i.test(
        address,
      )
    )
      continue;
    const offers = arr(x.offers),
      offer = offers.find(
        (o) => o.price !== undefined && o.priceCurrency === "CAD",
      );
    out.push({
      id: "",
      sourceId: s.id,
      sourceName: s.name,
      url,
      title: plain(String(x.name || "")),
      text: plain(String(x.description || "")).slice(0, 4000),
      venue: loc.name,
      address,
      occurrences: [{ start, end }],
      price: offer ? `${offer.price} CAD` : "check organizer",
      imageKey: s.imageKey,
    });
  }
  return out;
}
export async function collectEvents(
  s: Source,
  now: Date,
): Promise<VerifiedEvent[]> {
  if (!s.enabled || !s.rightsReviewed) return [];
  const listing = await safeFetch(s.url, s.hosts),
    $ = load(listing.body);
  const urls = [
    ...new Set(
      $(s.selector || "a[href]")
        .map((_, el) => {
          try {
            return approvedUrl(
              new URL($(el).attr("href") || "", s.url).href,
              s.hosts,
            ).href;
          } catch {
            return "";
          }
        })
        .get()
        .filter(Boolean),
    ),
  ].slice(0, 18);
  const all = parseEvents(listing.body, listing.url, s, now);
  for (const url of urls) {
    try {
      const page = await safeFetch(url, s.hosts);
      all.push(...parseEvents(page.body, url, s, now));
    } catch {}
  }
  const unique = new Map<string, VerifiedEvent>();
  for (const e of all) {
    e.id = await hash(e.url + "|" + e.occurrences[0].start);
    unique.set(e.id, e);
  }
  return [...unique.values()];
}
