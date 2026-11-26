import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Keep every dashboard top bar 48px tall, including its bottom border. */
export function DashboardHeader({ children, contained = false }: { children: ReactNode; contained?: boolean }) {
  return <header data-dashboard-header className="sticky top-0 z-50 h-12 shrink-0 border-b border-border bg-background text-foreground">
    <div className={cn("flex h-full min-w-0 items-center justify-between gap-3 px-4 sm:px-8", contained && "mx-auto max-w-7xl")}>
      {children}
    </div>
  </header>;
}

export function DashboardBrand({ label, href = "/dashboard" }: { label?: string; href?: string }) {
  return <Link href={href} className="flex min-w-0 items-center gap-2.5 text-sm font-semibold">
    <span className="flex size-8 shrink-0 items-center justify-center"><Image src="/Media/Ro-LinkIcon.png" alt="" width={25} height={25} /></span>
    <span className="shrink-0">Ro-Link</span>
    {label && <span className="hidden truncate text-muted-foreground sm:inline">/ {label}</span>}
  </Link>;
}
