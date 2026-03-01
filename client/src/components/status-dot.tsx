import { cn } from "@/lib/utils";

type StatusDotVariant =
  | "online"    // pulsing green — live presence
  | "available" // static green — accepting clients / available
  | "busy"      // static amber — in session / busy
  | "offline";  // static muted — offline / fully booked

type StatusDotSize = "sm" | "md";

interface StatusDotProps {
  variant?: StatusDotVariant;
  size?: StatusDotSize;
  className?: string;
  /** Accessible label for screen readers */
  label?: string;
}

const SIZE: Record<StatusDotSize, string> = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
};

const COLOR: Record<StatusDotVariant, string> = {
  online:    "bg-emerald-500",
  available: "bg-emerald-500",
  busy:      "bg-amber-400",
  offline:   "bg-muted-foreground/40",
};

const PING_COLOR: Record<StatusDotVariant, string> = {
  online:    "bg-emerald-400",
  available: "",
  busy:      "",
  offline:   "",
};

export function StatusDot({
  variant = "offline",
  size = "sm",
  className,
  label,
}: StatusDotProps) {
  const dot = (
    <span
      className={cn(
        "rounded-full shrink-0",
        SIZE[size],
        COLOR[variant],
        variant === "online" && "relative inline-flex",
        className
      )}
      role="img"
      aria-label={label ?? variant}
    >
      {variant === "online" && (
        <>
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              PING_COLOR[variant]
            )}
          />
          <span
            className={cn(
              "relative inline-flex rounded-full",
              SIZE[size],
              COLOR[variant]
            )}
          />
        </>
      )}
    </span>
  );

  return dot;
}
