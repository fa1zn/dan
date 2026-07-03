import type { ReactNode } from "react";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { TooltipProvider } from "@/components/ui";
import { Telemetry } from "@/components/telemetry";
import { isGloballyEnabled, NOTICE_VERSION } from "@/lib/telemetry";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata = {
  title: "Dan, Pam's sales guy",
  description:
    "Dan is Pam's AI sales rep. This is his book of business: the system of record for North American franchise dealerships.",
};

// Set the theme class + data-view (Enriched/Raw) before paint to avoid a flash of the
// wrong theme or the persisted data mode being ignored on first load.
const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}var v=localStorage.getItem('dan-view');if(v==='raw'||v==='enriched'){document.documentElement.dataset.view=v;}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${serif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="font-sans antialiased">
        <TooltipProvider delayDuration={150}>
          <AppShell>{children}</AppShell>
          <Telemetry enabled={isGloballyEnabled()} noticeVersion={NOTICE_VERSION} />
        </TooltipProvider>
      </body>
    </html>
  );
}
