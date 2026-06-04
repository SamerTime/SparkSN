import Link from "next/link";

type SparkLogoProps = {
  href?: string;
  compact?: boolean;
  inverse?: boolean;
};

export function SparkLogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 320"
      aria-hidden="true"
      className={className}
      role="img"
    >
      <defs>
        <linearGradient id="sparkFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cfeaf7" />
          <stop offset="20%" stopColor="#5fb0dc" />
          <stop offset="55%" stopColor="#1f6fa3" />
          <stop offset="100%" stopColor="#0c3d5e" />
        </linearGradient>
        <linearGradient id="sparkTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#d6eaf6" />
          <stop offset="100%" stopColor="#7fb8d8" />
        </linearGradient>
        <linearGradient id="sparkSide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3a8cb6" />
          <stop offset="100%" stopColor="#0c3d5e" />
        </linearGradient>
        <linearGradient id="sparkInner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#082a42" />
          <stop offset="100%" stopColor="#1f6fa3" />
        </linearGradient>
        <symbol id="sparkFrame" viewBox="0 0 110 250" overflow="visible">
          <path d="M90,4 L104,12 L104,248 L90,240 Z" fill="url(#sparkSide)" />
          <path
            d="M0,4 L14,-4 L104,4 L90,12 Z"
            fill="url(#sparkTop)"
            opacity="0.95"
          />
          <path d="M58,108 L68,114 L68,232 L58,226 Z" fill="#0a324c" />
          <path
            d="M0,4 L90,12 L90,240 L0,232 Z M30,100 L60,104 L60,224 L30,220 Z"
            fill="url(#sparkFace)"
            fillRule="evenodd"
          />
          <path
            d="M30,100 L60,104 L60,224 L30,220 Z"
            fill="url(#sparkInner)"
            opacity="0.6"
          />
          <path d="M0,4 L90,12 L90,18 L0,10 Z" fill="#ffffff" opacity="0.35" />
        </symbol>
      </defs>
      <g transform="translate(20,60)">
        <use href="#sparkFrame" width="110" height="250" />
      </g>
      <g transform="translate(72,40)">
        <use href="#sparkFrame" width="110" height="250" />
      </g>
      <g transform="translate(132,18)">
        <use href="#sparkFrame" width="110" height="250" />
      </g>
    </svg>
  );
}

export function SparkLogo({
  href = "/jobs",
  compact = false,
  inverse = false,
}: SparkLogoProps) {
  const textClass = inverse ? "text-white" : "text-[var(--sn-ink)]";

  return (
    <Link href={href} className="flex items-center gap-3 no-underline">
      <SparkLogoMark className="h-9 w-10 shrink-0" />
      {!compact && (
        <span className="leading-none">
          <span className={`block text-lg font-extrabold tracking-normal ${textClass}`}>
            StaffingNation
          </span>
          <span className="block text-xs font-extrabold tracking-normal text-[var(--sn-coral)]">
            SPARK
          </span>
        </span>
      )}
    </Link>
  );
}

export function SparkInitials({
  label,
  color = "var(--sn-blue)",
  size = "md",
}: {
  label: string | null | undefined;
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = (label || "SP")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const sizeClass =
    size === "lg" ? "h-14 w-14 text-lg" : size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";

  return (
    <span
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-lg font-extrabold text-white`}
      style={{ background: color }}
    >
      {initials || "SP"}
    </span>
  );
}
