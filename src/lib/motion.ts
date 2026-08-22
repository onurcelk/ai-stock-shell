export const easeOut = [0.16, 1, 0.3, 1] as const;
export const easeInOut = [0.65, 0, 0.35, 1] as const;

export const transitionOut = { duration: 0.18, ease: easeOut };
export const transitionInOut = { duration: 0.32, ease: easeInOut };

export const springSnappy = { type: "spring" as const, stiffness: 400, damping: 30 };
export const springSoft = { type: "spring" as const, stiffness: 120, damping: 20 };

export const staggerContainer = (stagger = 0.05, delayChildren = 0) => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: transitionInOut },
};
