import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  href?: string;
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "sm" | "md";
};

export function GlassButton({
  children,
  className,
  href,
  variant = "default",
  size = "md",
  type = "button",
  ...props
}: GlassButtonProps) {
  const classes = cn(
    "glass-button",
    variant === "primary" && "glass-button-primary",
    variant === "danger" && "glass-button-danger",
    variant === "ghost" && "glass-button-ghost",
    size === "sm" ? "px-3 py-2 text-sm" : "px-5 py-2.5 text-sm",
    className,
  );

  if (href) {
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} type={type} {...props}>
      {children}
    </button>
  );
}
