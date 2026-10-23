import { Clock3, Command, FileText, KeyRound, LayoutDashboard, LayoutTemplate, Package, Radio, ScrollText, Settings, ShieldCheck, Store, TriangleAlert, Upload, Users } from "lucide-react";
import styles from "./page-icon.module.css";

const icons = {
  overview: LayoutDashboard, roles: Users, commands: Command, logging: ScrollText,
  reports: TriangleAlert, dashboard: LayoutTemplate, settings: Settings,
  shifts: Clock3, shiftSettings: Clock3, verification: ShieldCheck, setup: KeyRound,
  modules: Package, marketplace: Store, creator: Upload, live: Radio, player: Users,
  logs: FileText,
};

export function PageIcon({ name, compact = false }: { name: keyof typeof icons; compact?: boolean }) {
  const Icon = icons[name];
  return <span aria-hidden="true" data-slot="page-icon" className={`${styles.badge} ${styles[name]} ${compact ? styles.compact : ""}`}><Icon className={compact ? "size-4" : "size-6"} /></span>;
}
