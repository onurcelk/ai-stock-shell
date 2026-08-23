/**
 * The desk's navigation, in one place.
 *
 * Adding a page is one entry here — the header, the mobile menu, and anything
 * else that needs to know what the desk contains all read this list, so the
 * shell never has to be rebuilt to gain a tab.
 */

export interface Route {
  href: string;
  label: string;
}

/** Live pages, in the order the header shows them. */
export const ROUTES: Route[] = [
  { href: "/signal", label: "Signal" },
  { href: "/chart", label: "Chart" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/basket", label: "Basket" },
  { href: "/forecast", label: "Forecast" },
  { href: "/agents", label: "Agents" },
  { href: "/montecarlo", label: "Monte Carlo" },
  { href: "/history", label: "History" },
  { href: "/research", label: "Research" },
];

/**
 * Pages the rebuild still owes, kept here rather than in a plan document so the
 * order the header will eventually show is visible from the code that renders
 * it. Deliberately not rendered: a nav entry that leads nowhere is worse than a
 * missing one. Move an entry into ROUTES when its page lands.
 *
 * Empty since Phase 6: Forecast and Agents were the last two, and they are in
 * ROUTES above. Kept rather than deleted because the convention is the useful
 * part -- the next page to be planned goes here first.
 */
export const PLANNED: Route[] = [];

/** Where the landing page's primary call to action sends people. */
export const DESK_HOME = "/signal";
