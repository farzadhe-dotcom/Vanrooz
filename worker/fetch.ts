export function approvedUrl(input: string, hosts: string[]): URL {
  const u = new URL(input);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    !hosts.includes(u.hostname)
  )
    throw Error("URL_NOT_APPROVED");
  u.hash = "";
  return u;
}
export async function safeFetch(
  input: string,
  hosts: string[],
  maxBytes = 1_500_000,
): Promise<{ body: string; url: string; type: string }> {
  let u = approvedUrl(input, hosts);
  for (let n = 0; n < 4; n++) {
    const r = await fetch(u, {
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
      headers: {
        "User-Agent":
          "Vanrooz/1.0 (daily news research; respectful bounded fetching)",
        Accept:
          "application/rss+xml, application/atom+xml, text/html, application/json;q=0.9",
      },
    });
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      const loc = r.headers.get("Location");
      if (!loc) throw Error("INVALID_REDIRECT");
      u = approvedUrl(new URL(loc, u).href, hosts);
      continue;
    }
    if (!r.ok) throw Error(`SOURCE_HTTP_${r.status}`);
    if (Number(r.headers.get("content-length") || 0) > maxBytes)
      throw Error("SOURCE_TOO_LARGE");
    const reader = r.body?.getReader();
    if (!reader) throw Error("EMPTY_SOURCE");
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw Error("SOURCE_TOO_LARGE");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let o = 0;
    for (const c of chunks) {
      bytes.set(c, o);
      o += c.length;
    }
    return {
      body: new TextDecoder().decode(bytes),
      url: u.href,
      type: r.headers.get("content-type") || "",
    };
  }
  throw Error("TOO_MANY_REDIRECTS");
}
