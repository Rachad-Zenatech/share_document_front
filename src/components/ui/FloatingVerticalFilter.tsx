import { useState, useEffect } from "react";
import { X, Filter, ChevronLeft, ChevronRight } from "lucide-react";

export type CardColorVariant = "blue" | "orange" | "fuchsia" | "green" | "violet" | "amber" | "sky" | "slate" | "red" | "rose";

export interface FilterItem {
  key: string;
  label: string;
  count?: number | string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: CardColorVariant;
}

interface FloatingVerticalFilterProps {
  items: FilterItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  onReset?: () => void;
  defaultKey?: string;
  title?: string;
  className?: string;
  isKpiCollapsed?: boolean;
  kpiRef?: React.RefObject<HTMLElement | null>;
  scrollThreshold?: number;
}

const COLOR_STYLES: Record<
  CardColorVariant,
  {
    active: string;
    inactive: string;
    badgeActive: string;
    badgeInactive: string;
    iconActive: string;
    iconInactive: string;
  }
> = {
  blue: {
    active: "bg-blue-600 text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-400 border-blue-600",
    inactive: "bg-blue-50/90 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 border-blue-200/80 dark:border-blue-800/80",
    badgeActive: "bg-white text-blue-700 font-bold border border-blue-200 shadow-sm",
    badgeInactive: "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-bold border border-background shadow-sm",
    iconActive: "text-white",
    iconInactive: "text-blue-600 dark:text-blue-400",
  },
  orange: {
    active: "bg-orange-600 text-white shadow-md shadow-orange-500/30 ring-2 ring-orange-400 border-orange-600",
    inactive: "bg-orange-50/90 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/60 dark:text-orange-300 dark:hover:bg-orange-900/60 border-orange-200/80 dark:border-orange-800/80",
    badgeActive: "bg-white text-orange-700 font-bold border border-orange-200 shadow-sm",
    badgeInactive: "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-bold border border-background shadow-sm",
    iconActive: "text-white",
    iconInactive: "text-orange-600 dark:text-orange-400",
  },
  fuchsia: {
    active: "bg-fuchsia-600 text-white shadow-md shadow-fuchsia-500/30 ring-2 ring-fuchsia-400 border-fuchsia-600",
    inactive: "bg-fuchsia-50/90 text-fuchsia-700 hover:bg-fuchsia-100 dark:bg-fuchsia-950/60 dark:text-fuchsia-300 dark:hover:bg-fuchsia-900/60 border-fuchsia-200/80 dark:border-fuchsia-800/80",
    badgeActive: "bg-white text-fuchsia-700 font-bold border border-fuchsia-200 shadow-sm",
    badgeInactive: "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-bold border border-background shadow-sm",
    iconActive: "text-white",
    iconInactive: "text-fuchsia-600 dark:text-fuchsia-400",
  },
  green: {
    active: "bg-emerald-600 text-white shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400 border-emerald-600",
    inactive: "bg-emerald-50/90 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 border-emerald-200/80 dark:border-emerald-800/80",
    badgeActive: "bg-white text-emerald-700 font-bold border border-emerald-200 shadow-sm",
    badgeInactive: "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-bold border border-background shadow-sm",
    iconActive: "text-white",
    iconInactive: "text-emerald-600 dark:text-emerald-400",
  },
  violet: {
    active: "bg-violet-600 text-white shadow-md shadow-violet-500/30 ring-2 ring-violet-400 border-violet-600",
    inactive: "bg-violet-50/90 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/60 dark:text-violet-300 dark:hover:bg-violet-900/60 border-violet-200/80 dark:border-violet-800/80",
    badgeActive: "bg-white text-violet-700 font-bold border border-violet-200 shadow-sm",
    badgeInactive: "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-bold border border-background shadow-sm",
    iconActive: "text-white",
    iconInactive: "text-violet-600 dark:text-violet-400",
  },
  amber: {
    active: "bg-amber-600 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-400 border-amber-600",
    inactive: "bg-amber-50/90 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60 border-amber-200/80 dark:border-amber-800/80",
    badgeActive: "bg-white text-amber-700 font-bold border border-amber-200 shadow-sm",
    badgeInactive: "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-bold border border-background shadow-sm",
    iconActive: "text-white",
    iconInactive: "text-amber-600 dark:text-amber-400",
  },
  sky: {
    active: "bg-sky-600 text-white shadow-md shadow-sky-500/30 ring-2 ring-sky-400 border-sky-600",
    inactive: "bg-sky-50/90 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/60 border-sky-200/80 dark:border-sky-800/80",
    badgeActive: "bg-white text-sky-700 font-bold border border-sky-200 shadow-sm",
    badgeInactive: "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-bold border border-background shadow-sm",
    iconActive: "text-white",
    iconInactive: "text-sky-600 dark:text-sky-400",
  },
  slate: {
    active: "bg-slate-700 text-white shadow-md shadow-slate-500/30 ring-2 ring-slate-400 border-slate-700",
    inactive: "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 border-slate-200 dark:border-zinc-700",
    badgeActive: "bg-white text-slate-800 font-bold border border-slate-200 shadow-sm",
    badgeInactive: "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-bold border border-background shadow-sm",
    iconActive: "text-white",
    iconInactive: "text-slate-600 dark:text-slate-400",
  },
  red: {
    active: "bg-red-600 text-white shadow-md shadow-red-500/30 ring-2 ring-red-400 border-red-600",
    inactive: "bg-red-50/90 text-red-700 hover:bg-red-100 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-900/60 border-red-200/80 dark:border-red-800/80",
    badgeActive: "bg-white text-red-700 font-bold border border-red-200 shadow-sm",
    badgeInactive: "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-bold border border-background shadow-sm",
    iconActive: "text-white",
    iconInactive: "text-red-600 dark:text-red-400",
  },
  rose: {
    active: "bg-rose-600 text-white shadow-md shadow-rose-500/30 ring-2 ring-rose-400 border-rose-600",
    inactive: "bg-rose-50/90 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-900/60 border-rose-200/80 dark:border-rose-800/80",
    badgeActive: "bg-white text-rose-700 font-bold border border-rose-200 shadow-sm",
    badgeInactive: "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-bold border border-background shadow-sm",
    iconActive: "text-white",
    iconInactive: "text-rose-600 dark:text-rose-400",
  },
};

export function FloatingVerticalFilter({
  items,
  activeKey,
  onSelect,
  onReset,
  defaultKey,
  title = "Quick Filter",
  className = "",
  isKpiCollapsed = false,
  kpiRef,
  scrollThreshold = 300,
}: FloatingVerticalFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isScrolledPast, setIsScrolledPast] = useState(false);

  useEffect(() => {
    const mainEl = document.querySelector("main");
    if (!mainEl) return;

    if (kpiRef?.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          // Only true when cards are 100% scrolled out of view
          setIsScrolledPast(!entry.isIntersecting);
        },
        {
          root: mainEl,
          threshold: 0,
        }
      );
      observer.observe(kpiRef.current);
      return () => observer.disconnect();
    } else {
      const checkScroll = () => {
        setIsScrolledPast(mainEl.scrollTop > (scrollThreshold ?? 300));
      };
      checkScroll();
      mainEl.addEventListener("scroll", checkScroll, { passive: true });
      return () => mainEl.removeEventListener("scroll", checkScroll);
    }
  }, [kpiRef, scrollThreshold]);

  const isVisible = isKpiCollapsed || isScrolledPast;
  const hasNonDefaultFilter = defaultKey !== undefined ? activeKey !== defaultKey : onReset !== undefined;

  return (
    <div
      className={`fixed right-2 sm:right-4 top-1/2 -translate-y-1/2 z-40 flex items-center transition-all duration-300 ease-out ${
        isVisible
          ? "opacity-100 translate-x-0 pointer-events-auto"
          : "opacity-0 translate-x-12 pointer-events-none"
      } ${className}`}
    >
      {/* Toggle Expand Tab */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-5 h-8 flex items-center justify-center rounded-l-md bg-background/95 dark:bg-zinc-900/95 backdrop-blur-md border-y border-l border-slate-200 dark:border-zinc-800 shadow-md text-muted-foreground hover:text-foreground transition-colors -mr-px"
        title={isExpanded ? "Collapse quick filter" : "Expand quick filter"}
      >
        {isExpanded ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      {/* Vertical Pill Dock */}
      <div
        className={`bg-background/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200/90 dark:border-zinc-800 shadow-xl rounded-2xl p-1.5 flex flex-col items-center gap-1.5 transition-all duration-300 ${
          isExpanded ? "w-48" : "w-11"
        }`}
      >
        {/* Header Icon / Title */}
        <div className="w-full flex items-center justify-between px-1 py-0.5 border-b border-border/50 text-muted-foreground mb-0.5">
          <div className="flex items-center justify-center w-full overflow-hidden">
            {isExpanded ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground truncate">
                    {title}
                  </span>
                </div>
                {hasNonDefaultFilter && onReset && (
                  <button
                    type="button"
                    onClick={onReset}
                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-[9px]"
                    title="Reset filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ) : (
              <Filter className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
            )}
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="w-full flex flex-col gap-1.5 items-center">
          {items.map((item) => {
            const Icon = item.icon;
            const isSelected = activeKey === item.key;
            const colorKey = item.color || "blue";
            const styles = COLOR_STYLES[colorKey] || COLOR_STYLES.blue;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelect(item.key)}
                title={`${item.label} (${item.count ?? 0})`}
                className={`relative flex items-center border rounded-xl transition-all duration-150 ${
                  isExpanded
                    ? "w-full justify-between px-2.5 py-1.5"
                    : "w-8 h-8 justify-center p-0"
                } ${isSelected ? styles.active : styles.inactive}`}
              >
                {/* Icon & Label */}
                <div className={`flex items-center ${isExpanded ? "gap-2 min-w-0" : "justify-center w-full h-full"}`}>
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      isSelected ? styles.iconActive : styles.iconInactive
                    }`}
                  />
                  {isExpanded && (
                    <span className={`text-xs font-medium truncate text-left ${isSelected ? "text-white" : "text-slate-800 dark:text-zinc-200"}`}>
                      {item.label}
                    </span>
                  )}
                </div>

                {/* High Contrast Count Badge */}
                {item.count !== undefined && (
                  <span
                    className={`${
                      isExpanded
                        ? `text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center rounded-full ${
                            isSelected ? styles.badgeActive : styles.badgeInactive
                          }`
                        : `absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] flex items-center justify-center leading-none ${
                            isSelected ? styles.badgeActive : styles.badgeInactive
                          }`
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Reset button for collapsed mode */}
        {!isExpanded && hasNonDefaultFilter && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="mt-0.5 w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-destructive hover:bg-destructive/10 transition-colors text-[9px]"
            title="Reset to default filter"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export default FloatingVerticalFilter;
