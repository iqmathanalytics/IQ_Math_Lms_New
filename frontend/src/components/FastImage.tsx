import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { isImageWarmed, markImageWarmed, optimizeImageUrl, resolveImageUrl } from "../utils/imageUrl";

type FastImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
  /** Display width hint for CDN resize (default 640) */
  widthHint?: number;
  /** Eager = above-the-fold / LCP; lazy = default */
  priority?: boolean;
  /** Extra classes for the outer shell (sizing). */
  skeletonClassName?: string;
  /**
   * contain/cover = fill a fixed box.
   * natural = full-width image; section height follows the image aspect ratio (no crop).
   */
  fit?: "contain" | "cover" | "natural";
};

/**
 * Faster perceived image loads: CDN/proxy resize, async decode, lazy load,
 * skeleton placeholder, original-URL fallback, and warm-cache for remounts.
 */
const FastImage = ({
  src,
  alt = "",
  className = "",
  widthHint = 640,
  priority = false,
  skeletonClassName = "",
  fit = "natural",
  onLoad,
  onError,
  ...rest
}: FastImageProps) => {
  const original = resolveImageUrl(src);
  const optimized = optimizeImageUrl(src, {
    width: widthHint,
    quality: 72,
    fit: fit === "cover" ? "cover" : "contain",
  });
  const [currentSrc, setCurrentSrc] = useState(optimized || original);
  const [loaded, setLoaded] = useState(() =>
    optimized ? isImageWarmed(optimized) : Boolean(original && isImageWarmed(original))
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const next =
      optimizeImageUrl(src, {
        width: widthHint,
        quality: 72,
        fit: fit === "cover" ? "cover" : "contain",
      }) || resolveImageUrl(src);
    setCurrentSrc(next);
    setFailed(false);
    setLoaded(next ? isImageWarmed(next) : false);
  }, [src, widthHint, fit]);

  const isNatural = fit === "natural";
  const shellClass = skeletonClassName || (isNatural ? "w-full" : "w-full h-full");
  const fitClass =
    fit === "cover" ? "object-cover" : fit === "contain" ? "object-contain" : "h-auto w-full";

  if (!currentSrc || failed) {
    return (
      <div
        className={`bg-slate-100 ${isNatural ? "aspect-video w-full" : ""} ${shellClass}`}
        aria-hidden
      />
    );
  }

  return (
    <div className={`relative overflow-hidden bg-slate-50 ${isNatural ? "w-full" : ""} ${shellClass}`}>
      {!loaded && (
        <div
          className={`animate-pulse bg-gradient-to-r from-slate-100 via-slate-200/80 to-slate-100 ${
            isNatural ? "aspect-video w-full" : "absolute inset-0"
          }`}
          aria-hidden
        />
      )}
      <img
        src={currentSrc}
        alt={alt}
        className={`${fitClass} ${className} ${
          loaded ? "opacity-100 relative" : isNatural ? "absolute inset-0 opacity-0" : "opacity-0"
        } transition-opacity duration-150`}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "low"}
        {...rest}
        onLoad={(e) => {
          markImageWarmed(currentSrc);
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          if (original && currentSrc !== original) {
            setLoaded(false);
            setCurrentSrc(original);
            return;
          }
          setFailed(true);
          onError?.(e);
        }}
      />
    </div>
  );
};

export default FastImage;
