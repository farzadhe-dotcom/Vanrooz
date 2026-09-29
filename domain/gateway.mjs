// Public reader gateway for externally managed DNS. No credentials belong here.
const origin = "https://vanrooz.farzadhe.workers.dev";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!["GET", "HEAD"].includes(request.method)) {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    const publicApi = url.pathname === "/api/health" ||
      /^\/api\/editions\/\d{4}-\d{2}-\d{2}$/.test(url.pathname);
    const publicAsset = url.pathname === "/" ||
      url.pathname.startsWith("/assets/") || url.pathname.startsWith("/photos/") ||
      url.pathname === "/favicon.ico";
    if (!publicApi && !publicAsset) return new Response(null, { status: 404 });

    const target = new URL(origin);
    target.pathname = url.pathname;
    if (url.pathname === "/") {
      for (const name of ["date", "article", "event"]) {
        const value = url.searchParams.get(name);
        if (value) target.searchParams.set(name, value);
      }
    }
    try {
      const upstream = await fetch(target, {
        method: request.method,
        headers: { Accept: request.headers.get("Accept") || "*/*" },
        redirect: "manual",
        signal: AbortSignal.timeout(25000),
      });
      if (upstream.status >= 300 && upstream.status < 400) {
        return new Response(null, { status: 502 });
      }
      const headers = new Headers(upstream.headers);
      headers.delete("Set-Cookie");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      return new Response(request.method === "HEAD" ? null : upstream.body, {
        status: upstream.status,
        headers,
      });
    } catch {
      return new Response(publicApi ? '{"error":"SERVICE_UNAVAILABLE"}' :
        "دریافت خبرها ممکن نشد. لطفاً کمی بعد دوباره تلاش کنید.", {
        status: 503,
        headers: { "Content-Type": publicApi ? "application/json" : "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
  },
};
