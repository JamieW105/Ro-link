"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronRight, LogOut, PanelLeft, X } from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Status, StatusIndicator } from "@/components/ui/status";
import styles from "./theme.module.css";
import { cn } from "@/lib/utils";
import type { CustomDashboardLayout } from "@/lib/customDashboardSettings";

type NavigationGroup = { label: string; items: { label: string; href: string; icon: ReactNode }[] };
type DashboardChromeProps = {
  children: ReactNode;
  groups: NavigationGroup[];
  serverId: string;
  brand: string;
  userName: string;
  userAvatarUrl?: string | null;
  latency: string;
  online: boolean;
  homeHref: string;
  customHost: boolean;
  layout: CustomDashboardLayout;
  style?: CSSProperties;
};

export function DashboardChrome({ children, groups, serverId, brand, userName, userAvatarUrl, latency, online, homeHref, customHost, layout, style }: DashboardChromeProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const [category, setCategory] = useState(groups.find(group => group.items.some(item => item.href === pathname))?.label || groups[0]?.label);
  const active = groups.flatMap(group => group.items).find(item => item.href === pathname);
  const horizontal = layout === "spacious" || layout === "floating_dock";
  const drawer = layout === "minimalist_drawer";
  const compact = layout === "compact";
  const visibleGroups = layout === "split_sidebar" ? groups.filter(group => group.label === category) : groups;

  function navigation(mobile = false) {
    return <nav aria-label={mobile ? "Mobile dashboard" : "Dashboard"} className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {(mobile ? groups : visibleGroups).filter(group => group.items.length).map(group => <div key={group.label}>
        {(!compact || mobile) && <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">{group.label}</p>}
        <div className="space-y-1">{group.items.map(item => <Button key={item.href} asChild variant="ghost" size="sm" className={cn("h-9 w-full justify-start gap-3 px-3 font-normal", pathname === item.href && "bg-accent font-medium text-accent-foreground", compact && !mobile && "justify-center px-0")}>
          <Link href={item.href} title={item.label} aria-label={item.label} aria-current={pathname === item.href ? "page" : undefined} onClick={() => { if (pathname === item.href) setOpen(false); }}>
            <span className="shrink-0 [&_svg]:size-4">{item.icon}</span>{(!compact || mobile) && <span className="truncate">{item.label}</span>}
          </Link>
        </Button>)}</div>
      </div>)}
    </nav>;
  }

  function brandHeader(mobile = false) {
    return <div className="flex h-16 items-center gap-2 border-b border-border px-4">
      <Link href={homeHref} aria-label={`${brand} workspace`} className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/5"><Image src="/Media/Ro-LinkIcon.png" alt="" width={25} height={25} /></span>
        {(!compact || mobile) && <div className="min-w-0"><div className="truncate text-sm font-semibold">{brand}</div><div className="text-xs text-muted-foreground">Workspace</div></div>}
      </Link>
      {(!compact || mobile) && <ChevronDown className="size-4 text-muted-foreground" />}
    </div>;
  }

  function accountFooter(mobile = false) {
    const collapsed = compact && !mobile;
    return <div data-slot="sidebar-account" className="shrink-0 border-t border-border p-2">
      <div className={cn("flex items-center gap-2 rounded-md px-1 py-1", collapsed && "justify-center px-0")}>
        {userAvatarUrl && failedAvatar !== userAvatarUrl
          ? <Image src={userAvatarUrl} alt={`${userName}'s Discord avatar`} width={28} height={28} unoptimized className="size-7 shrink-0 rounded-full object-cover" onError={() => setFailedAvatar(userAvatarUrl)} />
          : <span role="img" aria-label={`${userName}'s avatar unavailable`} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-medium">{userName.slice(0, 2).toUpperCase()}</span>}
        {!collapsed && <><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{userName}</p><p className="text-[10px] text-muted-foreground">Discord account</p></div><Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Sign out" onClick={() => void signOut({callbackUrl:"/auth/signin"})}><LogOut className="size-3.5" /></Button></>}
      </div>
      {!collapsed && !customHost && <Button variant="ghost" size="sm" asChild className="mt-1 h-7 w-full justify-start gap-2 px-1 text-xs text-muted-foreground"><Link href="/dashboard"><ArrowLeft className="size-3.5" />Switch server</Link></Button>}
    </div>;
  }

  return <div className={cn(styles.theme, "dice-ui-dashboard custom-dashboard-shell dice-shell flex h-dvh min-w-0 bg-background text-foreground")} data-dashboard-layout={layout} style={style}>
    {layout === "split_sidebar" && <div className="hidden w-14 flex-col items-center gap-2 border-r border-border bg-muted/40 py-5 md:flex">{groups.filter(group => group.items.length).map(group => <Button key={group.label} variant={category === group.label ? "secondary" : "ghost"} size="icon" aria-label={group.label} onClick={() => setCategory(group.label)}>{group.items[0]?.icon}</Button>)}</div>}
    {!horizontal && !drawer && <aside className={cn("hidden shrink-0 flex-col border-r border-border bg-muted/30 md:flex", compact ? "w-16" : "w-60")}>
      {brandHeader()}
      {navigation()}
      {accountFooter()}
    </aside>}
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild><Button variant="ghost" size="icon" aria-label="Open navigation" className={cn("size-8", !drawer && "md:hidden")}><PanelLeft className="size-4" /></Button></Dialog.Trigger>
            <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[160] bg-black/30" /><Dialog.Content className={cn(styles.theme, "dice-ui-dashboard fixed inset-y-0 left-0 z-[170] flex w-72 flex-col border-r border-border bg-background text-foreground shadow-lg")}>
              <Dialog.Title className="sr-only">Dashboard navigation</Dialog.Title><Dialog.Description className="sr-only">Choose a dashboard page.</Dialog.Description>
              {brandHeader(true)}{navigation(true)}{accountFooter(true)}
              <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close navigation" className="absolute right-2 top-3"><X className="size-4" /></Button></Dialog.Close>
            </Dialog.Content></Dialog.Portal>
          </Dialog.Root>
          <span className="hidden text-sm text-muted-foreground sm:inline">Workspace</span><ChevronRight className="hidden size-4 text-muted-foreground sm:block" /><span className="truncate text-sm font-medium">{active?.label === "Home" ? "Overview" : active?.label || "Dashboard"}</span>
        </div>
        <div className="flex items-center gap-3"><ThemeToggle /><Status variant={online ? "success" : "warning"} className="hidden border-0 bg-transparent px-0 text-xs sm:inline-flex"><StatusIndicator />{online ? "Connected" : "Checking connection"}</Status><Separator orientation="vertical" className="hidden h-4 sm:block" /><span className="hidden text-xs tabular-nums text-muted-foreground lg:block">{latency}</span><Button asChild variant="outline" size="sm"><Link href={homeHref}>{customHost ? "Dashboard home" : "All servers"}<ArrowUpRight className="size-3.5" /></Link></Button></div>
      </header>
      {horizontal && <nav aria-label="Dashboard" className={cn("hidden items-center gap-1 overflow-x-auto border-b border-border bg-background px-6 py-2 md:flex", layout === "floating_dock" && "fixed bottom-4 left-1/2 z-40 max-w-[90vw] -translate-x-1/2 rounded-xl border p-2 shadow-md")}>{groups.flatMap(group => group.items).map(item => <Button key={item.href} asChild variant={pathname === item.href ? "secondary" : "ghost"} size="sm"><Link href={item.href}>{item.icon}{item.label}</Link></Button>)}</nav>}
      <main className={cn("dashboard-content-frame min-h-0 min-w-0 flex-1 overflow-y-auto bg-background p-5 md:p-8", layout === "floating_dock" && "pb-24")}>
        <div className="mx-auto w-full max-w-[1440px]">{children}</div>
      </main>
      <footer className="flex h-9 shrink-0 items-center justify-between border-t border-border px-5 text-[11px] text-muted-foreground md:px-8"><span>Ro-Link workspace</span><span className="truncate">Server {serverId}</span></footer>
    </div>
  </div>;
}
