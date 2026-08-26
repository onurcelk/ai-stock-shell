"use client";

import { useId, useRef } from "react";
import { motion, useInView } from "motion/react";
import { easeInOut } from "@/lib/motion";

/**
 * A left-to-right reveal for stroked SVG geometry.
 *
 * Not `pathLength`, which is the obvious way to draw a line on and is what
 * every chart here used to do. Motion implements that animation with
 * `stroke-dasharray` — it sets `pathLength="1"` on the path and animates the
 * dash between `0 1` and `1 1` — and Chromium measures the dash in device
 * space when the path also carries `vector-effect="non-scaling-stroke"`, which
 * every chart here does carry and needs to. The two together disagree about
 * what "1" means: the normalisation is computed against the path's length in
 * viewBox units and the dash is laid out against its length in pixels, so the
 * resting line is left chopped into evenly spaced chunks with the gaps between
 * them simply absent. That is what a "missing" indicator line was — the line
 * was there, dashed into pieces by its own entrance animation.
 *
 * Clipping the drawing region reveals the identical stroke without touching
 * how it is dashed, so the guide dashes below still read as guides and a solid
 * series still lands solid.
 *
 * The clip rect is scaled rather than resized because a transform is the one
 * thing Motion will drop for a reader who asked for reduced motion — the
 * target value is applied at once and the geometry ends up fully revealed,
 * which is the correct still frame.
 */
export function DrawIn({
  width,
  height,
  duration = 0.8,
  delay = 0,
  onView = false,
  children,
}: {
  /** viewBox width — the reveal sweeps across it. */
  width: number;
  /** viewBox height. The clip is drawn tall enough to spare an overflowing
   *  stroke, since these charts render with `overflow-visible`. */
  height: number;
  duration?: number;
  delay?: number;
  /** Reveal when scrolled into view rather than on mount. */
  onView?: boolean;
  children: React.ReactNode;
}) {
  // `useId` returns colons, which are legal in an id but awkward in a URL
  // reference; strip them rather than find out per browser.
  const id = `draw-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;

  // Watched on the clipped group, not on the rect that does the sweeping: the
  // rect lives in `<defs>` and is never laid out, so an intersection observer
  // on it would report it off-screen for ever and the reveal would never run.
  const group = useRef<SVGGElement | null>(null);
  const seen = useInView(group, { once: true, margin: "-80px" });
  const revealed = onView ? seen : true;

  return (
    <>
      <defs>
        <clipPath id={id}>
          <motion.rect
            x={0}
            y={-height}
            width={width}
            height={height * 3}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: revealed ? 1 : 0 }}
            // Origin at the viewBox's left edge, so the swept region is
            // [0, width * scaleX] and the timing is linear in x.
            style={{ transformOrigin: "0px 0px" }}
            transition={{ duration, delay, ease: easeInOut }}
          />
        </clipPath>
      </defs>
      <g ref={group} clipPath={`url(#${id})`}>
        {children}
      </g>
    </>
  );
}
