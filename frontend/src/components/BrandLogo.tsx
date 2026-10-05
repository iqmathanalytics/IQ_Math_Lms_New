import React from "react";
import { publicAsset } from "../utils/appBase";

interface BrandLogoProps {
    size?: "sm" | "md" | "lg" | "xl";
    /** Logo asset already includes “Technologies”; kept for call-site compatibility. */
    showTagline?: boolean;
    /** Use the higher-resolution logo asset when available. */
    hiRes?: boolean;
    className?: string;
}

const heightClasses = {
    sm: "h-7",
    md: "h-10",
    lg: "h-14",
    xl: "h-16 sm:h-[4.75rem]",
} as const;

/**
 * IQMath brand mark (image). Transparent PNG works on light and dark surfaces.
 */
const BrandLogo: React.FC<BrandLogoProps> = ({
    size = "md",
    hiRes = false,
    className = "",
}) => {
    const src = publicAsset(hiRes ? "iqmath-logo-4k.png" : "iqmath-logo.png");

    return (
        <img
            src={src}
            alt="IQMath Technologies"
            className={`w-auto object-contain object-left ${heightClasses[size]} ${className}`}
            draggable={false}
        />
    );
};

export default BrandLogo;
