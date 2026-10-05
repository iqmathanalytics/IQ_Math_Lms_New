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
  /** Prefer contain so thumbnails are not cropped by the CDN */
  fit?: "contain" | "cover" | "max";
};

/**
 * Shrink remote CDN URLs when the host supports it.
 * (postimg / ibb have no public resize API — callers should use object-contain + prefetch.)
 */
export function optimizeImageUrl(url?: string | null, opts: OptimizeOpts = {}): string {
  const resolved = resolveImageUrl(url);
  if (!resolved) return "";

  const width = opts.width ?? 640;
  const quality = opts.quality ?? 72;
  const fit = opts.fit ?? "contain";

  try {
    const u = new URL(resolved);

    // Unsplash — avoid fit=crop (that was cutting thumbs)
    if (u.hostname.includes("images.unsplash.com") || u.hostname.includes("unsplash.com")) {
      u.searchParams.set("auto", "format");
      u.searchParams.set("fit", fit === "cover" ? "crop" : "max");
      u.searchParams.set("w", String(width));
      u.searchParams.set("q", String(quality));
      return u.toString();
    }

    // Freepik CDN
    if (u.hostname.includes("freepik.com") || u.hostname.includes("img.freepik.com")) {
      u.searchParams.set("w", String(Math.min(width, 800)));
      return u.toString();
    }

    // Google Drive → native thumbnail endpoint
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
  // Stagger slightly so we don't saturate bandwidth on first paint
  urls.forEach((raw, index) => {
    const src = optimizeImageUrl(raw, { width, fit: "contain" });
    if (!src || isImageWarmed(src)) return;
    window.setTimeout(() => {
      if (isImageWarmed(src)) return;
      const img = new Image();
      img.decoding = "async";
      img.onload = () => markImageWarmed(src);
      img.src = src;
    }, index * 40);
  });
}
