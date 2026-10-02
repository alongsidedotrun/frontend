import type { ReactNode } from "react";

export function WorkspaceSurface({ children, collapsed = false }: { children: ReactNode; collapsed?: boolean }) {
  return (
      <div
        style={{
          borderTop: "1px solid #2a2a2a",
          borderLeft: collapsed ? undefined : "1px solid #2a2a2a",
        }}
        className={`relative isolate flex min-w-0 flex-1 overflow-hidden bg-[#111111] ${collapsed ? "" : "rounded-tl-2xl border-l border-[#2a2a2a]"}`}
      >
      {children}
    </div>
  );
}
