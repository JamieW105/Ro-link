"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Blocks,
  BriefcaseBusiness,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Menu,
  MessageSquare,
  OctagonX,
  Server,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  DashboardHeader,
  DashboardBrand,
} from "@/components/dashboard/DashboardHeader";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { LoadingState } from "@/app/management/SiteContentFields";
import { cn } from "@/lib/utils";
import styles from "@/components/dashboard/theme.module.css";

const navItems: Array<{
  name: string;
  href: string;
  icon: LucideIcon;
  perm: string;
}> = [
  {
    name: "Overview",
    href: "/management",
    icon: LayoutDashboard,
    perm: "RO_LINK_DASHBOARD",
  },
  {
    name: "Servers",
    href: "/management/servers",
    icon: Server,
    perm: "MANAGE_SERVERS",
  },
  {
    name: "Job Apps",
    href: "/management/jobs",
    icon: BriefcaseBusiness,
    perm: "POST_JOB_APPLICATION",
  },
  {
    name: "Updates",
    href: "/management/posts",
    icon: FileText,
    perm: "POST_UPDATES",
  },
  {
    name: "Site Banners",
    href: "/management/site-banners",
    icon: Megaphone,
    perm: "MANAGE_RO_LINK",
  },
  {
    name: "Pricing Page",
    href: "/management/pricing",
    icon: CircleDollarSign,
    perm: "MANAGE_RO_LINK",
  },
  {
    name: "Features Page",
    href: "/management/features",
    icon: ListChecks,
    perm: "MANAGE_RO_LINK",
  },
  {
    name: "DMs",
    href: "/management/dms",
    icon: MessageSquare,
    perm: "MANAGE_RO_LINK",
  },
  {
    name: "Modules",
    href: "/management/modules",
    icon: Blocks,
    perm: "MANAGE_MODULES",
  },
  {
    name: "Blocking",
    href: "/management/blocking",
    icon: OctagonX,
    perm: "BLOCK_SERVERS",
  },
  {
    name: "People",
    href: "/management/people",
    icon: UsersRound,
    perm: "MANAGE_RO_LINK",
  },
];

export default function ManagementShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [perms, setPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const owner = userId === "953414442060746854";

  useEffect(() => {
    let cancelled = false;
    setPerms([]);
    if (status === "loading") return;
    if (!userId || owner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch("/api/management/check")
      .then(async (res) => (res.ok ? res.json() : { permissions: [] }))
      .then((data) => {
        if (!cancelled) setPerms(data.permissions || []);
      })
      .catch(() => {
        if (!cancelled) setPerms([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, owner, status]);
  useEffect(() => {
    setIsNavOpen(false);
  }, [pathname]);

  const allowed = owner || perms.includes("RO_LINK_DASHBOARD");
  const filteredNav = navItems.filter(
    (item) =>
      owner || perms.includes(item.perm) || perms.includes("MANAGE_RO_LINK"),
  );
  function navigation(mobile = false) {
    return (
      <nav
        aria-label={mobile ? "Mobile management" : "Management"}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-y-contain p-3"
      >
        {filteredNav.map(({ name, href, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/management" && pathname.startsWith(`${href}/`));
          return (
            <Button
              key={href}
              asChild
              variant={active ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => setIsNavOpen(false)}
              >
                <Icon aria-hidden="true" className="size-4" />
                {name}
              </Link>
            </Button>
          );
        })}
      </nav>
    );
  }
  return (
    <div
      className={cn(
        styles.theme,
        styles.shell,
        "dice-ui-dashboard management-shell flex min-w-0 bg-background text-foreground",
      )}
    >
      {status === "loading" || loading ? (
        <div role="status" aria-label="Loading management" className="w-full">
          <LoadingState />
        </div>
      ) : !allowed ? (
        <main className="m-auto space-y-4 p-6 text-center">
          <ThemeToggle />
          <h1 className="text-2xl font-semibold">Access denied</h1>
          <p className="text-muted-foreground">
            You do not have permission to access the Ro-Link Management
            Dashboard.
          </p>
          <Button asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </main>
      ) : (
        <>
          <aside className="hidden min-h-0 w-60 shrink-0 flex-col border-r border-border bg-muted/30 md:flex">
            <div className="flex h-12 shrink-0 items-center border-b border-border px-4">
              <DashboardBrand href="/management" />
            </div>
            {navigation()}
            <div className="shrink-0 border-t border-border p-3">
              <p className="truncate px-3 py-2 text-xs text-muted-foreground">
                {session?.user?.name}
              </p>
              <Button asChild variant="ghost" className="w-full justify-start">
                <Link href="/dashboard">
                  <ArrowLeft className="size-4" />
                  Exit Management
                </Link>
              </Button>
            </div>
          </aside>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <DashboardHeader>
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 md:hidden"
                  aria-label="Open navigation"
                  onClick={() => setIsNavOpen(true)}
                >
                  <Menu className="size-4" />
                </Button>
                <span className="truncate text-sm font-medium">Management</span>
              </div>
              <ThemeToggle />
            </DashboardHeader>
            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain p-4 md:p-8">
              {children}
            </main>
            <footer className="flex h-9 shrink-0 items-center border-t border-border px-4 text-xs text-muted-foreground">
              Ro-Link management
            </footer>
          </div>
          <Dialog open={isNavOpen} onOpenChange={setIsNavOpen}>
            <DialogContent className="inset-y-0 left-0 flex h-dvh w-72 max-w-[90vw] translate-x-0 translate-y-0 flex-col rounded-none p-0">
              <DialogHeader className="shrink-0 border-b border-border p-4">
                <DialogTitle>Management navigation</DialogTitle>
                <DialogDescription>Choose a management page.</DialogDescription>
              </DialogHeader>
              {navigation(true)}
              <div className="shrink-0 space-y-2 border-t border-border p-3">
                <Button
                  asChild
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <Link href="/dashboard">
                    <ArrowLeft className="size-4" />
                    Exit Management
                  </Link>
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="w-full">
                    Close navigation
                  </Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
