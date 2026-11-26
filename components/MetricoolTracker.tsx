"use client";

import Script from "next/script";

declare global {
  interface Window {
    beTracker?: { t: (options: { hash: string }) => void };
  }
}

export function MetricoolTracker() {
  return (
    <Script
      src="https://tracker.metricool.com/resources/be.js"
      strategy="afterInteractive"
      onLoad={() => {
        window.beTracker?.t({ hash: "e171d0051cc25b8a22ff002c8b992d0b" });
      }}
    />
  );
}
