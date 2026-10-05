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
 * IQMath brand mark (image). Always the light color PNG (transparent), never the dark/black plate.
 */
const BrandLogo: React.FC<BrandLogoProps> = ({
    size = "md",
    className = "",
}) => {
    const src = publicAsset("iqmath-logo.png");

    return (
        <img
            src={src}
            alt="IQMath Technologies"
            className={`bg-transparent w-auto object-contain object-left ${heightClasses[size]} ${className}`}
            draggable={false}
            decoding="async"
        />
    );
};

export default BrandLogo;
