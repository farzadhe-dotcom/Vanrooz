import { describe, it, expect } from "vitest";
import {
  localDay,
  dateLabels,
  shiftDay,
  due,
  validDay,
  occurrenceStatus,
} from "../shared/date";
import { approvedUrl } from "../worker/fetch";
import { parseFeed, parseEvents, inNewsWindow } from "../worker/collect";
import { sources } from "../worker/sources";
describe("Vancouver calendar", () => {
  it("uses Pacific midnight rather than UTC", () => {
    expect(localDay(new Date("2026-09-28T06:59:00Z"))).toBe("2026-09-27");
    expect(localDay(new Date("2026-09-28T07:00:00Z"))).toBe("2026-09-28");
  });
  it("crosses Persian month boundary", () => {
    expect(dateLabels("2026-09-22").faMonth).toBe("شهریور");
    expect(dateLabels("2026-09-23").faMonth).toBe("مهر");
    expect(dateLabels("2026-09-22").faNumber).toBe("۳۱");
    expect(dateLabels("2026-09-23").faNumber).toBe("۱");
  });
  it("runs at 8am through DST boundaries only once", () => {
    for (const d of ["2026-03-07", "2026-03-08", "2026-11-01", "2026-11-02"]) {
      expect(
        [15, 16].filter((h) => due(new Date(`${d}T${h}:00:00Z`))),
      ).toHaveLength(1);
    }
    expect(due(new Date("2026-09-28T15:00:00Z"))).toBe(true);
    expect(due(new Date("2026-12-28T15:00:00Z"))).toBe(true);
    expect(due(new Date("2025-12-28T16:00:00Z"))).toBe(true);
  });
  it("rejects impossible archive dates", () => {
    expect(validDay("2026-02-30")).toBe(false);
    expect(validDay("2026-09-28")).toBe(true);
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("does not call gaps in recurring occurrences ongoing", () => {
    expect(
      occurrenceStatus(
        [
          {
            start: "2026-10-03T10:00:00-07:00",
            end: "2026-10-03T18:00:00-07:00",
          },
          {
            start: "2026-10-10T10:00:00-07:00",
            end: "2026-10-10T18:00:00-07:00",
          },
        ],
        new Date("2026-10-05T18:00:00Z"),
      ),
    ).toBe("upcoming");
  });
});
describe("collection boundaries", () => {
  it("rejects unsafe URLs, credentials and lookalike hosts", () => {
    for (const url of [
      "http://good.ca",
      "https://good.ca.evil.test",
      "https://good.ca@evil.test",
      "https://good.ca:8080/",
      "https://127.0.0.1",
      "file:///etc/passwd",
    ])
      expect(() => approvedUrl(url, ["good.ca"])).toThrow();
    expect(approvedUrl("https://good.ca/news#x", ["good.ca"]).href).toBe(
      "https://good.ca/news",
    );
  });
  it("reads actual RSS and Atom without treating summaries as fulltext", () => {
    expect(
      parseFeed(
        "<rss><channel><item><title>A</title><link>https://good.ca/a</link><pubDate>Mon, 28 Sep 2026 08:00:00 GMT</pubDate><description>Short summary</description></item></channel></rss>",
      )[0].text,
    ).toBe("Short summary");
    expect(
      parseFeed(
        '<feed><entry><title>B</title><link href="https://good.ca/b" rel="alternate"/><published>2026-09-28T08:00:00Z</published><summary>Summary</summary></entry></feed>',
      )[0].url,
    ).toBe("https://good.ca/b");
  });
  it("rejects XML entities and future/stale news", () => {
    expect(() =>
      parseFeed('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///secret">]><rss/>'),
    ).toThrow();
    expect(inNewsWindow("2026-09-29", new Date("2026-09-28"))).toBe(false);
    expect(inNewsWindow("2026-09-24", new Date("2026-09-28"))).toBe(false);
  });
  it("requires explicit event endpoints; skips recurring ranges and cancellations", () => {
    const s = sources[2],
      now = new Date("2026-09-28"),
      ev = {
        "@type": "Event",
        name: "Example",
        description: "Event fixture",
        startDate: "2026-10-03T18:00:00-07:00",
        endDate: "2026-10-03T20:00:00-07:00",
        location: { name: "Venue", address: "Vancouver" },
      };
    const parse = (x: any) =>
      parseEvents(
        `<script type="application/ld+json">${JSON.stringify(x)}</script>`,
        s.url,
        s,
        now,
      );
    expect(parse(ev)).toHaveLength(1);
    expect(
      parse({ ...ev, eventSchedule: { repeatFrequency: "P1W" } }),
    ).toHaveLength(0);
    expect(parse({ ...ev, endDate: "2026-10-20T20:00:00-07:00" })).toHaveLength(
      0,
    );
    expect(
      parse({ ...ev, eventStatus: "https://schema.org/EventCancelled" }),
    ).toHaveLength(0);
  });
});
