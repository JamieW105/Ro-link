"use client";

import { useEffect } from "react";

export function HashScroll() {
  useEffect(() => {
    const scrollToSection = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;

      window.requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView();
      });
    };

    scrollToSection();
    window.addEventListener("hashchange", scrollToSection);
    return () => window.removeEventListener("hashchange", scrollToSection);
  }, []);

  return null;
}
