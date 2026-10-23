"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  const label = `Switch to ${dark ? "light" : "dark"} mode`;
  return <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label={label} title={label} aria-pressed={dark} disabled={!mounted} onClick={() => setTheme(dark ? "light" : "dark")}>
    {dark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
  </Button>;
}
