# Source audit — September 28, 2026

Access varies by environment; no access-control bypass was attempted.

| Source | Verified access/discovery | State |
|---|---|---|
| TransLink Buzzer | Homepage advertises https://buzzer.translink.ca/feed/; HTTP 200, 10 items | Disabled: general terms reserve rights and restrict redistribution/modification; separate media licence is not blanket text translation permission. |
| Canada | Exact Atom URL discovered on Canada.ca subscription page; HTTP 200, 100 entries | Disabled pending department-specific rights and attribution review. No assumption that summaries are full text. |
| Vancouver Civic Theatres | Official /events/ HTTP 200 via Node, JavaScript templates without direct JSON-LD schedules | Disabled pending a verified dedicated adapter and rights review. |
| UBC News | Node homepage HTTP 200, advertises https://news.ubc.ca/feed/ | Not configured: feed/terms not yet verified. |
| City of Vancouver | News visible in search; direct fetch 403 | Not configured: RSS terms require linked attribution and restrict reuse, conflicting with source-name-only display. |
| BC Gov News | Direct fetch 502 | Not configured; feed not guessed. |
| CBC / CityNews | Potential sources requested by owner | Not configured; no assumption of API/full-text/reuse permission. |

Rights sources reviewed:
- https://www.translink.ca/terms-and-conditions
- https://www.canada.ca/en/transparency/terms.html
- https://vancouver.ca/your-government/terms-of-use.aspx

These are implementation gates, not a claim that original factual reporting is universally prohibited. Accessibility is not permission for unrestricted translation/republication.

## Bundled photograph

Coal Harbour, Vancouver, 2004, Andrew Raun.
Source: https://commons.wikimedia.org/wiki/File:Coal_harbour_vancouver.jpg
Downloaded original: https://upload.wikimedia.org/wikipedia/commons/3/39/Coal_harbour_vancouver.jpg
Licence: CC BY 2.0, https://creativecommons.org/licenses/by/2.0/
UI retains creator/source/licence, indicates display cropping and labels it a related photograph, not incident evidence.

## Official technical documentation consulted

- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workflows/build/workers-api/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://supabase.com/changelog.md
- https://supabase.com/docs/guides/api/securing-your-api
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://www2.gov.bc.ca/gov/content/governments/celebrating-british-columbia/daylight-saving-time

Supabase's September 25 Postgres security update was reviewed; this new schema has no affected legacy indexes or encrypted data. GPT-6 Luna's public documentation does not establish access/pricing in the owner's account.

Further organizer discovery: the official Civic Theatres `/js/app.js` points to `https://vancouvercivictheatres.com/umbraco/api/eventsListing/GetAllEvents/`. That endpoint returned HTTP 200 with approximately 1.49 MB of historical/current listings; 41 listings overlapped September 28–October 28, 2026. Its broad start/end ranges do not represent daily occurrences. Detail pages list individual performance dates/times without guaranteed end times. A dedicated adapter and honest unknown-end handling are still needed; no publication permission is implied by API access.
