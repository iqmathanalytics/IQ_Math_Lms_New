import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { isImageWarmed, markImageWarmed, optimizeImageUrl } from "../utils/imageUrl";

type FastImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
  /** Display width hint for CDN resize (default 640) */
  widthHint?: number;
  /** Eager = above-the-fold / LCP; lazy = default */
  priority?: boolean;
  /** Extra classes for the skeleton placeholder */
  skeletonClassName?: string;
};

/**
 * Faster perceived image loads: CDN resize, async decode, lazy load,
 * skeleton placeholder, and warm-cache so remounts are instant.
 */
const FastImage = ({
  src,
  alt = "",
  className = "",
  widthHint = 640,
  priority = false,
  skeletonClassName = "",
  onLoad,
  onError,
  ...rest
}: FastImageProps) => {
  const optimized = optimizeImageUrl(src, { width: widthHint, quality: 72 });
  const [loaded, setLoaded] = useState(() => (optimized ? isImageWarmed(optimized) : false));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(optimized ? isImageWarmed(optimized) : false);
  }, [optimized]);

  const shellClass = skeletonClassName || "w-full h-full";

  if (!optimized || failed) {
    return <div className={`bg-slate-200 animate-pulse ${shellClass}`} aria-hidden />;
  }

  return (
    <>
      {!loaded && <div className={`absolute inset-0 bg-slate-200 animate-pulse ${shellClass}`} aria-hidden />}
      <img
        src={optimized}
        alt={alt}
        className={`${className} ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-150`}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onLoad={(e) => {
          markImageWarmed(optimized);
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          setFailed(true);
          onError?.(e);
        }}
        {...rest}
      />
    </>
  );
};

export default FastImage;
