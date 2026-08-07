import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { BackgroundFX } from "@/components/common/BackgroundFX";

export function AppShell({ children }: { children: ReactNode }) {
  // Page transitions: a quick fade + rise whenever the route path changes.
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <RequireAuth>
      <div className="relative flex min-h-screen w-full bg-background text-foreground">
        <BackgroundFX />
        <div className="relative z-10 flex min-w-0 flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopNav />
            <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}
