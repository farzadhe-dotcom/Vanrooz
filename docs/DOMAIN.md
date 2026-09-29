# parsivancouver.com

Registry lookup on September 28, 2026 confirmed registration that day through Wix, with ns12.wixdns.net and ns13.wixdns.net. No DNS records have been changed by this implementation.

Wix does not permit changing nameservers on its registered domains. The new registration is subject to the 60-day transfer restriction. Workers Custom Domains require an active Cloudflare zone. The supported immediate setup is a Cloudflare Pages gateway at **www.parsivancouver.com**, using a CNAME managed at Wix.

The small `domain/` gateway serves the public website from the existing Vanrooz Worker, including same-origin edition requests. Only GET/HEAD public routes are forwarded to the fixed Worker host. Visitor credentials, private admin endpoints and mutations are excluded. No secrets or OpenAI keys belong in the Pages project. Existing Worker configuration, database, scheduling and model usage remain in the Worker. The gateway depends on the workers.dev address remaining enabled and consumes Pages Functions requests.

## Create the Pages project

In Cloudflare Workers & Pages, create a **Pages** project from `farzadhe-dotcom/Vanrooz`:

- Project name: `vanrooz-domain` (or another available Pages name).
- Production branch: `main`.
- Root directory: `domain`.
- Framework preset: None.
- Build command: `npm run build`.
- Build output directory: `dist`.
- No runtime secrets required.

The root directory must be `domain` so Pages uses the dedicated Pages configuration instead of the existing root Worker configuration. The build runs four gateway security/error tests and writes the advanced-mode `_worker.js` output.

After deployment, test the actual assigned pages.dev address and its `/api/editions/YYYY-MM-DD` endpoint. In the Pages project's Custom domains, add `www.parsivancouver.com` FIRST, then use the exact CNAME target assigned by Cloudflare in Wix Domains → Manage DNS Records. Do not guess the pages.dev hostname. Preserve all unrelated DNS and email records. Verify Cloudflare certificate activation and HTTPS before announcing the custom domain.

## Bare domain

`parsivancouver.com` without `www` is not configured by this gateway. It needs a separately verified HTTPS forwarding service or a later registrar/DNS change after transfer eligibility. Do not replace the apex A records with a workers.dev or pages.dev hostname (A records require an IP), and do not copy an arbitrary Cloudflare IP. Confirm existing email and DNS records before any registrar/DNS migration. Domain transfer/forwarding purchases require owner action.

## Verification

Gateway code and local checks are prepared. Pages provisioning, the assigned pages.dev address, Wix DNS change, certificate activation and bare-domain forwarding remain pending. No custom-domain deployment is claimed.

References:
- https://support.wix.com/en/article/connecting-a-wix-domain-to-an-external-site
- https://support.wix.com/en/article/transferring-your-wix-domain-away-from-wix-2477749
- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/pages/functions/advanced-mode/
