// Owner-reviewed local image only. Manifest path supplied by CLI; no secrets in argv.
import { readFile } from "node:fs/promises";
const manifest = JSON.parse(await readFile(process.argv[2], "utf8"));
for (const k of [
  "id",
  "file",
  "creator",
  "sourceUrl",
  "licence",
  "licenceUrl",
  "alt",
  "contentType",
])
  if (!manifest[k]) throw Error(`Missing ${k}`);
if (
  !/^[a-z0-9-]+$/.test(manifest.id) ||
  !["image/jpeg", "image/png", "image/webp"].includes(manifest.contentType)
)
  throw Error("Invalid image metadata");
for (const k of ["sourceUrl", "licenceUrl"])
  if (new URL(manifest[k]).protocol !== "https:") throw Error("HTTPS required");
const root = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
if (!root || !key) throw Error("Secure Supabase environment required");
const bytes = await readFile(manifest.file);
if (bytes.length > 5 * 1024 * 1024) throw Error("Image exceeds limit");
const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[manifest.contentType],
  path = `${manifest.id}.${extension}`;
const headers = {
  apikey: key,
  ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
};
const r = await fetch(`${root}/storage/v1/object/vanrooz-images/${path}`, {
  method: "POST",
  headers: {
    ...headers,
    "Content-Type": manifest.contentType,
    "x-upsert": "false",
  },
  body: bytes,
});
if (!r.ok && r.status !== 409)
  throw Error(`Storage upload failed: ${r.status}`);
const url = `${root}/storage/v1/object/public/vanrooz-images/${path}`;
if (!(await fetch(url, { method: "HEAD" })).ok)
  throw Error("Public image verification failed");
const metadata = {
  url,
  alt: manifest.alt,
  creator: manifest.creator,
  sourceUrl: manifest.sourceUrl,
  licence: manifest.licence,
  licenceUrl: manifest.licenceUrl,
  related: manifest.related !== false,
  changes: manifest.changes || "",
};
const saved = await fetch(`${root}/rest/v1/image_assets`, {
  method: "POST",
  headers: {
    ...headers,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates",
  },
  body: JSON.stringify({ id: manifest.id, metadata }),
});
if (!saved.ok) throw Error(`Image metadata save failed: ${saved.status}`);
console.log(JSON.stringify({ id: manifest.id, verified: true }));
