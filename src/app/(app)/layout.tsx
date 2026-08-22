import type { ReactNode } from "react";
import { Nav } from "@/components/nav";

/**
 * The desk's shell.
 *
 * A route group, so the URLs stay `/signal`, `/chart`, `/portfolio` — it exists
 * only to give every working page the same chrome. The landing page at `/` sits
 * outside it deliberately: it keeps its own full-bleed hero treatment.
 *
 * Each page still owns its own `<main>` and its own width — the portfolio is
 * wider than the signal because it carries tables — so this deliberately wraps
 * nothing but the nav around them.
 */
export default function DeskLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="px-6 pt-6">
        <Nav />
      </div>
      {children}
    </div>
  );
}
