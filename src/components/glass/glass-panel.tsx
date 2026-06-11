import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type GlassPanelProps = HTMLAttributes<HTMLElement> & {
  as?: "section" | "article" | "aside" | "div" | "header";
  variant?: "default" | "strong" | "subtle" | "danger";
};

export function GlassPanel({
  as: Component = "section",
  variant = "default",
  className,
  children,
  ...props
}: GlassPanelProps) {
  return (
    <Component
      className={cn(
        "glass-panel rounded-[26px] p-5 sm:p-6",
        variant === "strong" && "glass-panel-strong",
        variant === "subtle" && "glass-panel-subtle",
        variant === "danger" && "glass-panel-danger",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
