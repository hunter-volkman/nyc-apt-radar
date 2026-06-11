import {
  CalendarCheck,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  Plus,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActiveSection = "today" | "inbox" | "board" | "tours";

const navItems: Array<{
  id: ActiveSection;
  label: string;
  href: string;
  icon: ReactNode;
}> = [
  { id: "today", label: "Today", href: "/", icon: <LayoutDashboard /> },
  { id: "inbox", label: "Inbox", href: "/inbox", icon: <Inbox /> },
  { id: "board", label: "Board", href: "/board", icon: <ClipboardList /> },
  { id: "tours", label: "Tours", href: "/tours", icon: <CalendarCheck /> },
];

export function AppShell({
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
    <div className="stoop-page min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <Link className="flex min-w-0 items-center gap-3" href="/" aria-label="Stoop Today">
              <span className="stoop-on-primary grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold">
                S
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5">Stoop</span>
                <span className="block truncate text-xs leading-4 text-muted-foreground">
                  Your apartment hunt, ranked.
                </span>
              </span>
            </Link>
            <div className="flex lg:hidden">
              {action ?? <CaptureButton />}
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">
            {navItems.map((item) => (
              <Button
                asChild
                className={cn(
                  "h-8 shrink-0 justify-start px-2.5 text-sm",
                  active === item.id
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "text-muted-foreground hover:text-foreground",
                )}
                key={item.id}
                size="sm"
                variant={active === item.id ? "default" : "ghost"}
              >
                <Link href={item.href}>
                  <span className="[&>svg]:size-3.5">{item.icon}</span>
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>

          <div className="hidden flex-wrap justify-end gap-2 lg:flex">
            {action ?? <CaptureButton />}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="stoop-label">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

function CaptureButton() {
  return (
    <Button asChild size="sm">
      <Link href="/inbox">
        <Plus />
        Capture
      </Link>
    </Button>
  );
}
