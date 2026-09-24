import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeskThread } from "./types";

/** Collapsible chat history rail (SidebarNav pattern). */
export function DeskChatSidebar({
  threads,
  activeId,
  quotaLabel,
  onNewChat,
  onPick,
  collapsed,
  onCollapsedChange,
}: {
  threads: DeskThread[];
  activeId: string | null;
  quotaLabel: string;
  onNewChat: () => void;
  onPick: (id: string) => void;
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const visible = threads.filter((t) =>
    t.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <aside
      aria-label="Desk chat history"
      className={cn(
        "relative flex h-full shrink-0 flex-col overflow-hidden border border-border bg-background transition-[width] duration-280",
        collapsed ? "w-[52px]" : "w-[224px]",
      )}
      style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
    >
      <div className="flex min-h-0 w-[224px] shrink-0 flex-col">
        <div className="relative mb-2 h-10 shrink-0">
          {!collapsed && (
            <div className="absolute left-2 top-1 flex h-8 w-[164px] items-center px-2">
              <span className="text-[13px] font-bold uppercase tracking-[0.1em] text-foreground">
                Desk
              </span>
              <span className="ml-1.5 truncate text-[11px] text-muted-foreground">{quotaLabel}</span>
            </div>
          )}
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => {
              onCollapsedChange(!collapsed);
              setSearchOpen(false);
              setQuery("");
            }}
            className={cn(
              "absolute top-1 flex size-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              collapsed ? "left-2" : "right-2",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onNewChat}
          title="New chat"
          className="mx-2 flex h-8 items-center gap-2 rounded-sm px-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
        >
          <MessageSquarePlus className="size-[18px] shrink-0" />
          {!collapsed && <span>New chat</span>}
        </button>

        {!collapsed && (
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
            <div className="relative mx-2 mb-1 h-8">
              <div
                className={cn(
                  "absolute inset-0 flex items-center gap-1.5 px-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground transition-opacity",
                  searchOpen ? "pointer-events-none opacity-0" : "opacity-100",
                )}
              >
                <ChevronDown className="size-3.5" />
                Chats
              </div>
              <button
                type="button"
                aria-label="Search chats"
                onClick={() => setSearchOpen(true)}
                className={cn(
                  "absolute right-0 top-0 z-10 flex size-8 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground",
                  searchOpen && "pointer-events-none opacity-0",
                )}
              >
                <Search className="size-3.5" />
              </button>
              <div
                className={cn(
                  "absolute right-0 top-0 z-20 flex h-8 items-center overflow-hidden border border-border bg-muted/40 transition-[width,opacity]",
                  searchOpen ? "w-full opacity-100" : "w-7 opacity-0 pointer-events-none",
                )}
              >
                <Search className="ml-2 size-3.5 shrink-0 text-muted-foreground" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSearchOpen(false);
                      setQuery("");
                    }
                  }}
                  placeholder="Search chats"
                  aria-label="Search chat history"
                  className="ml-1.5 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery("");
                  }}
                  className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-px pb-3">
              {visible.map((t) => {
                const active = t.id === activeId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    title={t.title}
                    onClick={() => onPick(t.id)}
                    className={cn(
                      "mx-2 flex h-8 items-center rounded-sm px-2 text-left text-[13px] transition-colors active:scale-[0.98]",
                      active
                        ? "bg-muted font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <span className="truncate">{t.title}</span>
                  </button>
                );
              })}
              {query && visible.length === 0 && (
                <p className="mx-2 px-2 py-2 text-[12px] text-muted-foreground">No chats found</p>
              )}
              {!query && threads.length === 0 && (
                <p className="mx-2 px-2 py-2 text-[12px] text-muted-foreground">No chats yet</p>
              )}
            </div>
          </div>
        )}

        {!collapsed && (
          <div className="mx-2 mt-auto border-t border-border py-3">
            <p className="px-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Hard daily cap · keys stay server-side
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
