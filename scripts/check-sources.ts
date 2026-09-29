import { sources } from "../worker/sources.ts";
const results = [];
for (const s of sources) {
  try {
    const r = await fetch(s.url, {
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    const body = await r.text();
    results.push({
      id: s.id,
      url: s.url,
      status: r.status,
      contentType: r.headers.get("content-type"),
      bytes: new TextEncoder().encode(body).length,
      feedItems: (body.match(/<item\b|<entry\b/g) || []).length,
      structuredEvents: body.includes("application/ld+json"),
      enabled: s.enabled,
      rightsReviewed: s.rightsReviewed,
      checkedAt: new Date().toISOString(),
    });
  } catch {
    results.push({ id: s.id, status: "fetch_failed", enabled: s.enabled });
  }
}
console.log(JSON.stringify(results, null, 2));
