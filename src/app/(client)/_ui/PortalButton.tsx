import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "on-dark";
type Size = "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--portal-ink)] text-[var(--portal-cream)] shadow-[0_14px_34px_-18px_rgba(18,52,59,0.95)] hover:bg-[var(--portal-ink-soft)]",
  secondary:
    "border border-[var(--portal-border)] bg-white/70 text-stone-900 hover:bg-white",
  ghost:
    "text-[var(--portal-ink)] hover:text-[var(--portal-ink-soft)]",
  "on-dark":
    "bg-[var(--portal-highlight)] text-[var(--portal-ink)] shadow-[0_16px_38px_-22px_rgba(239,214,174,0.95)] hover:bg-[var(--portal-highlight-soft)]",
};

const sizeClasses: Record<Size, string> = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-sm",
};

/**
 * PortalButton — unified button treatment across the client portal.
 *
 * Accepts `href` to render an `<a>` via `next/link`, otherwise
 * a `<button>`. Always inline-flex with a trailing chevron when
 * `withArrow` is true.
 */
export function PortalButton({
  children,
  href,
  variant = "primary",
  size = "md",
  withArrow = false,
  className = "",
  ...rest
}: {
  children: ReactNode;
  href?: string;
  variant?: Variant;
  size?: Size;
  withArrow?: boolean;
  className?: string;
} & Omit<ComponentProps<"button">, "className">) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition";
  const classes =
    `${base} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim();
  const inner = (
    <>
      {children}
      {withArrow ? <ArrowRight className="h-4 w-4" /> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...rest}>
      {inner}
    </button>
  );
}
