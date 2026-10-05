import React from "react";

interface BrandLogoProps {
    size?: "sm" | "md" | "lg" | "xl";
    /** Optional green “Technologies” line under the wordmark. */
    showTagline?: boolean;
    /** Kept for compatibility; text logo does not use image assets. */
    hiRes?: boolean;
    className?: string;
}

const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
    xl: "text-5xl sm:text-6xl",
} as const;

const taglineClasses = {
    sm: "text-[0.55rem]",
    md: "text-[0.65rem]",
    lg: "text-sm",
    xl: "text-base sm:text-lg",
} as const;

/**
 * Site wordmark: IQ (green) + Math (blue). No image assets.
 */
const BrandLogo: React.FC<BrandLogoProps> = ({
    size = "md",
    showTagline = false,
    className = "",
}) => {
    return (
        <div className={`flex flex-col items-start leading-none ${className}`}>
            <span
                className={`font-extrabold tracking-tight ${sizeClasses[size]}`}
                aria-label="IQ Math"
            >
                <span className="text-iqGreen">IQ</span>
                <span className="text-iqBlue"> Math</span>
            </span>
            {showTagline && (
                <span
                    className={`mt-1 font-semibold tracking-[0.18em] text-iqGreen ${taglineClasses[size]}`}
                >
                    Technologies
                </span>
            )}
        </div>
    );
};

export default BrandLogo;
