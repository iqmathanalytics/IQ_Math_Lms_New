/**
 * Mount the LMS Cloudflare Pages app at https://www.iqmath.in/lms
 *
 * Setup (Cloudflare Dashboard):
 * 1. Workers & Pages → Create Worker → paste this file
 * 2. Settings → Variables → LMS_PAGES_ORIGIN =
 *      https://<your-pages-project>.pages.dev   (no trailing slash)
 * 3. Triggers → Add route:
 *      www.iqmath.in/lms*
 *      (also add iqmath.in/lms* if apex should serve LMS)
 *
 * Behaviour:
 * - /lms and /lms/ → Pages /
 * - /lms/login → Pages /login (SPA: falls back to index.html on 404)
 * - /lms/assets/... → Pages /assets/...
 * - Everything else on www is untouched (this Worker only runs on /lms* routes)
 */

const LMS_PREFIX = "/lms";

function pagesOrigin(env) {
  const raw = (env.LMS_PAGES_ORIGIN || "").trim().replace(/\/+$/, "");
  if (!raw) {
    throw new Error("Set Worker env LMS_PAGES_ORIGIN to your Pages URL, e.g. https://iqmath-lms.pages.dev");
  }
  return raw;
}

function stripLmsPrefix(pathname) {
  if (pathname === LMS_PREFIX || pathname === `${LMS_PREFIX}/`) {
    return "/";
  }
  if (pathname.startsWith(`${LMS_PREFIX}/`)) {
    const rest = pathname.slice(LMS_PREFIX.length);
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return pathname;
}

function isProbablyAsset(pathname) {
  return /\.[a-zA-Z0-9]{1,8}$/.test(pathname);
}

async function fetchFromPages(request, env, pathname) {
  const origin = pagesOrigin(env);
  const target = new URL(pathname + new URL(request.url).search, origin + "/");

  const init = {
    method: request.method,
    headers: request.headers,
    redirect: "manual",
  };

  // GET/HEAD have no body; avoid cloning issues on other methods
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  let response = await fetch(new Request(target.toString(), init));

  // SPA deep-link fallback: /lms/login etc. → index.html
  if (response.status === 404 && request.method === "GET" && !isProbablyAsset(pathname)) {
    const indexUrl = new URL("/", origin + "/");
    response = await fetch(
      new Request(indexUrl.toString(), {
        method: "GET",
        headers: request.headers,
        redirect: "manual",
      })
    );
  }

  // Avoid caching HTML so deploys show up immediately; assets keep Pages cache headers
  const headers = new Headers(response.headers);
  if (!isProbablyAsset(pathname) || pathname === "/" || pathname.endsWith(".html")) {
    headers.set("Cache-Control", "no-cache");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === LMS_PREFIX || url.pathname.startsWith(`${LMS_PREFIX}/`)) {
      const path = stripLmsPrefix(url.pathname);
      try {
        return await fetchFromPages(request, env, path);
      } catch (err) {
        return new Response(
          JSON.stringify({
            error: "LMS proxy misconfigured",
            detail: String(err && err.message ? err.message : err),
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Safety: if route is broader than /lms*, pass through to origin
    return fetch(request);
  },
};
