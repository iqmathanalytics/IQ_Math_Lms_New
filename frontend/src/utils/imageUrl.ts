import API_BASE_URL from "../config";

/** Resolve relative LMS paths to absolute URLs. */
export function resolveImageUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  const origin = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  return `${origin}/${url.replace(/^\//, "")}`;
}

type OptimizeOpts = {
  /** Target display width in CSS pixels */
  width?: number;
  /** 1–100 style quality hint for CDNs that support it */
  quality?: number;
};

/**
 * Shrink remote CDN URLs when possible so cards don't download 1000–2000px originals.
 * Unknown hosts are returned unchanged.
 */
export function optimizeImageUrl(url?: string | null, opts: OptimizeOpts = {}): string {
  const resolved = resolveImageUrl(url);
  if (!resolved) return "";

  const width = opts.width ?? 640;
  const quality = opts.quality ?? 70;

  try {
    const u = new URL(resolved);

    // Unsplash
    if (u.hostname.includes("images.unsplash.com") || u.hostname.includes("unsplash.com")) {
      u.searchParams.set("auto", "format");
      u.searchParams.set("fit", "crop");
      u.searchParams.set("w", String(width));
      u.searchParams.set("q", String(quality));
      return u.toString();
    }

    // Freepik CDN
    if (u.hostname.includes("freepik.com") || u.hostname.includes("img.freepik.com")) {
      u.searchParams.set("w", String(Math.min(width, 800)));
      return u.toString();
    }

    // postimg / i.postimg — no resize API; return as-is
    // Google Drive thumbnail rewrite for common view links
    if (u.hostname.includes("drive.google.com")) {
      const fileMatch = u.pathname.match(/\/d\/([^/]+)/) || u.searchParams.get("id");
      const id = typeof fileMatch === "string" ? fileMatch : fileMatch?.[1];
      if (id) {
        return `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`;
      }
    }

    return resolved;
  } catch {
    return resolved;
  }
}

/** Tiny in-memory set so remounted cards don't flash skeleton again. */
const warmed = new Set<string>();

export function markImageWarmed(src: string) {
  if (src) warmed.add(src);
}

export function isImageWarmed(src: string) {
  return warmed.has(src);
}

/** Prefetch a list of image URLs in the background (low priority). */
export function prefetchImages(urls: (string | null | undefined)[], width = 480) {
  if (typeof window === "undefined") return;
  urls.forEach((raw) => {
    const src = optimizeImageUrl(raw, { width });
    if (!src || isImageWarmed(src)) return;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => markImageWarmed(src);
    img.src = src;
  });
}
