import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

type SidebarSurfaceTransitionProps = {
  surfaceKey: string;
  children: ReactNode;
};

/** Shared in/out transition for sidebar-specific content surfaces. */
export function SidebarSurfaceTransition({ surfaceKey, children }: SidebarSurfaceTransitionProps) {
  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={surfaceKey}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -3 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
