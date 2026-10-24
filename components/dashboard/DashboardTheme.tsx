import type { ReactNode } from "react";
import styles from "./theme.module.css";

/** Bundle the palette with each dashboard entry point, including direct page loads. */
export function DashboardTheme({ children }: { children: ReactNode }) {
  return <div className={`dice-ui-dashboard contents ${styles.theme}`}>{children}</div>;
}
