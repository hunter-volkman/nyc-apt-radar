import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { GlassButton } from "@/components/glass/glass-button";

type ActiveSection = "today" | "inbox" | "board" | "tours";

const navItems: Array<{ id: ActiveSection; label: string; href: string }> = [
  { id: "today", label: "Today", href: "/" },
  { id: "inbox", label: "Inbox", href: "/inbox" },
  { id: "board", label: "Board", href: "/board" },
  { id: "tours", label: "Tours", href: "/tours" },
];

export function GlassShell({
  active,
  children,
  eyebrow,
  title,
  subtitle,
  action,
}: {
  active: ActiveSection;
  children: ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="city-backdrop">
      <header className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Link
              className="grid h-12 w-12 place-items-center rounded-2xl border border-white/18 bg-white/12 text-lg font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
              href="/"
              aria-label="Stoop Today"
            >
              S
            </Link>
            <div>
              <p className="fine-label">Stoop</p>
              <p className="text-sm font-semibold text-white/72">Your apartment hunt, ranked.</p>
            </div>
          </div>

          <nav className="scroll-snap-soft flex gap-2 overflow-x-auto rounded-full border border-white/12 bg-black/18 p-1">
            {navItems.map((item) => (
              <Link
                className={cn(
                  "min-h-10 shrink-0 rounded-full px-4 py-2 text-sm font-bold text-white/68 transition",
                  active === item.id ? "bg-white/18 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" : "hover:bg-white/10 hover:text-white",
                )}
                href={item.href}
                key={item.id}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="glass-panel glass-panel-strong rounded-[30px] px-5 py-6 sm:px-7 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="fine-label">{eyebrow}</p>
              <h1 className="mt-3 text-4xl font-black leading-tight text-white sm:text-5xl">{title}</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-white/72">{subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-3">{action ?? <GlassButton href="/inbox" variant="primary">Capture Listing</GlassButton>}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
