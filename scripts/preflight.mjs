// Run in a trusted terminal / CI with secrets in environment; never prints credentials.
const required = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "PRICING_MODEL",
  "INPUT_USD_PER_MILLION",
  "OUTPUT_USD_PER_MILLION",
];
for (const name of required)
  if (!process.env[name]) throw Error(`Missing ${name}`);
if (process.env.OPENAI_MODEL !== process.env.PRICING_MODEL)
  throw Error("Pricing does not match model");
const r = await fetch(
  "https://api.openai.com/v1/models/" +
    encodeURIComponent(process.env.OPENAI_MODEL),
  { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } },
);
if (!r.ok) throw Error(`Model access check failed: ${r.status}`);
const m = await r.json();
console.log(
  JSON.stringify({
    model: m.id,
    accessible: true,
    pricingRequiresOwnerVerification: true,
  }),
);
const hour = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Vancouver",
  hour: "2-digit",
  hourCycle: "h23",
}).format(new Date("2026-12-01T15:00:00Z"));
if (hour !== "08")
  throw Error(
    "Outdated timezone database: update runtime for BC permanent UTC-7",
  );
