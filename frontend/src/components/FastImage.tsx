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
  /** How the image fills its box — course thumbs should use contain (no crop). */
  fit?: "contain" | "cover";
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
  fit = "contain",
  onLoad,
  onError,
  ...rest
}: FastImageProps) => {
  const original = resolveImageUrl(src);
  const optimized = optimizeImageUrl(src, { width: widthHint, quality: 72, fit });
  const [currentSrc, setCurrentSrc] = useState(optimized || original);
  const [loaded, setLoaded] = useState(() =>
    optimized ? isImageWarmed(optimized) : Boolean(original && isImageWarmed(original))
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const next = optimizeImageUrl(src, { width: widthHint, quality: 72, fit }) || resolveImageUrl(src);
    setCurrentSrc(next);
    setFailed(false);
    setLoaded(next ? isImageWarmed(next) : false);
  }, [src, widthHint, fit]);

  const shellClass = skeletonClassName || "w-full h-full";
  const fitClass = fit === "cover" ? "object-cover" : "object-contain";

  if (!currentSrc || failed) {
    return <div className={`bg-slate-100 ${shellClass}`} aria-hidden />;
  }

  return (
    <div className={`relative overflow-hidden bg-slate-50 ${shellClass}`}>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-100 via-slate-200/80 to-slate-100" aria-hidden />
      )}
      <img
        src={currentSrc}
        alt={alt}
        className={`${fitClass} ${className} ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-100`}
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
          // Proxy/CDN miss → fall back to the original full URL once
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
