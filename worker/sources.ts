import type { Source } from "../shared/schema";
// Discovered from each publisher's actual HTML, not guessed endpoints.
// Enable only after access AND automated processing / attribution terms are reviewed.
export const sources: Source[] = [
  {
    id: "translink",
    name: "ترنس‌لینک",
    kind: "rss",
    url: "https://buzzer.translink.ca/feed/",
    hosts: ["buzzer.translink.ca"],
    section: "vancouver",
    enabled: false,
    rightsReviewed: false,
    rightsNote:
      "Feed HTTP 200 verified 2026-09-28. All rights reserved; automated processing and source-name-only attribution review pending. Original factual reports only, never full translations.",
    maxWords: 180,
    imageKey: "vancouver",
  },
  {
    id: "canada",
    name: "دولت کانادا",
    kind: "rss",
    url: "https://api.io.canada.ca/io-server/gc/news/en/v2?sort=publishedDate&orderBy=desc&publishedDate%3E=2021-10-25&pick=100&format=atom&atomtitle=National%20News",
    hosts: ["api.io.canada.ca", "www.canada.ca"],
    section: "canada",
    enabled: false,
    rightsReviewed: false,
    rightsNote:
      "Exact Atom URL discovered from Canada.ca subscription page. Endpoint access and commercial reuse/attribution review pending. Government status does not grant translation rights.",
    maxWords: 180,
    imageKey: "canada",
  },
  {
    id: "civic-theatres",
    name: "تئاترهای شهری ونکوور",
    kind: "events",
    url: "https://vancouvercivictheatres.com/events/",
    hosts: ["vancouvercivictheatres.com"],
    section: "vancouver",
    enabled: false,
    rightsReviewed: false,
    rightsNote:
      "Organizer listing found; automated fetch and structured schedule verification pending.",
    maxWords: 100,
    imageKey: "culture",
    selector: 'a[href^="/events/"]',
  },
];
