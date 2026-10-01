import { ChevronDown, ChevronRight, PanelRight } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { navigation, type NavigationItem } from "./Navigation";
import { useState } from "react";
import zenatechLogo from "@/assets/zenatech_logo.png";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import type { User } from "@/types/auth";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    "System & Security": true,
    "Logs & Audit": true,
  });
  const location = useLocation();
  const navigate = useNavigate();

  const { hasPermission, hasRole, user } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN") || user?.is_super_admin;

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.get<User[]>("/api/configuration/users"),
    enabled: !!isSuperAdmin,
  });

  const pendingUsersCount =
    users?.filter(
      (u) =>
        !u.is_super_admin &&
        (!u.assigned_roles ||
          u.assigned_roles.length === 0 ||
          u.assigned_roles.every((role) => role.code === "PENDING_USER"))
    ).length || 0;

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const groupedNavigation = navigation.reduce<Record<string, NavigationItem[]>>((acc, item) => {
    // Pure Role Permission Gating: Check item navigation permission
    if (item.navigationCode) {
      const hasItemAccess =
        isSuperAdmin ||
        hasPermission(`${item.navigationCode}_READ`) ||
        hasPermission(`${item.navigationCode}_VIEW`);
      if (!hasItemAccess) return acc;
    }

    const filteredSubItems = item.subItems
      ? item.subItems.filter((sub) => {
          if (sub.navigationCode) {
            const hasSubAccess =
              isSuperAdmin ||
              hasPermission(`${sub.navigationCode}_READ`) ||
              hasPermission(`${sub.navigationCode}_VIEW`);
            if (!hasSubAccess) return false;
          }
          return true;
        })
      : undefined;

    // If it had subItems but now they are all filtered out, don't show the parent
    if (item.subItems && (!filteredSubItems || filteredSubItems.length === 0)) {
      return acc;
    }

    const section = item.section || "GENERAL";
    if (!acc[section]) acc[section] = [];

    acc[section].push({ ...item, subItems: filteredSubItems });
    return acc;
  }, {});

  return (
    <>
      {/* Mobile & Tablet backdrop overlay */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs laptop:hidden animate-in fade-in"
        />
      )}

      <aside
        className={`
          fixed laptop:static top-0 bottom-0 left-0 z-50 h-full flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out shadow-lg laptop:shadow-none
          ${isOpen ? "w-52 tablet:w-56 desktop:w-60 translate-x-0" : "-translate-x-full laptop:translate-x-0 laptop:w-14"}
        `}
      >
        <div
          className={`flex items-center h-16 tablet:h-20 px-3 py-2 transition-all duration-300 ease-in-out ${
            isOpen ? "justify-between" : "laptop:justify-center"
          }`}
        >
          <Link
            to="/"
            className={`flex items-center flex-1 min-w-0 transition-all duration-300 ease-in-out ${
              isOpen ? "opacity-100" : "opacity-0 w-0 h-0 overflow-hidden"
            }`}
          >
            <img
              src={zenatechLogo}
              alt="Logo"
              className={`transition-all duration-300 ease-in-out object-contain cursor-pointer ${
                isOpen
                  ? "h-12 sm:h-14 tablet:h-16 w-auto max-w-[185px] tablet:max-w-[215px] scale-110 origin-left hover:scale-115"
                  : "w-0 h-0"
              }`}
            />
          </Link>

          <button
            onClick={onToggle}
            className="rounded-lg p-2 hover:bg-sidebar-accent flex-shrink-0 cursor-pointer text-sidebar-foreground"
            title="Toggle Sidebar"
          >
            <PanelRight size={20} />
          </button>
        </div>

        <TooltipProvider delayDuration={0}>
          <nav className="space-y-3 px-2 mt-2 pb-4 overflow-y-auto scrollbar-hide flex-1 min-h-0">
            {Object.entries(groupedNavigation).map(([section, items]) => (
              <div key={section} className="space-y-1">
                {isOpen ? (
                  <div className="px-3 mb-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                    {section}
                  </div>
                ) : (
                  <div className="h-4" />
                )}

                {items.map((item) => {
                  const Icon = item.icon;

                  if (item.subItems) {
                    const isExpanded = expandedItems[item.label];
                    return (
                      <div key={item.label} className="flex flex-col">
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                if (!isOpen) onToggle();
                                toggleExpand(item.label);
                                if (item.path) {
                                  navigate(item.path);
                                }
                              }}
                              className={`
                                flex items-center justify-between h-8 tablet:h-8.5 overflow-hidden rounded-md text-xs transition-all duration-300 ease-in-out hover:bg-sidebar-accent text-sidebar-foreground
                                ${isOpen ? "px-3" : "px-0 justify-center"}
                              `}
                            >
                              <div
                                className={`flex items-center ${
                                  isOpen ? "justify-start" : "justify-center"
                                }`}
                              >
                                <div className="flex items-center justify-center flex-shrink-0 relative">
                                  <Icon size={16} />
                                </div>
                                <span
                                  className={`text-xs font-medium transition-all duration-300 ease-in-out ${
                                    isOpen
                                      ? "opacity-100 ml-3 translate-x-0 w-auto"
                                      : "opacity-0 ml-0 -translate-x-4 w-0 overflow-hidden"
                                  }`}
                                >
                                  {item.label}
                                </span>
                              </div>
                              {isOpen && (
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {isExpanded ? (
                                    <ChevronDown size={16} />
                                  ) : (
                                    <ChevronRight size={16} />
                                  )}
                                </div>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="right"
                            sideOffset={10}
                            className={`font-semibold z-50 ${isOpen ? "hidden" : ""}`}
                          >
                            {item.label}
                          </TooltipContent>
                        </Tooltip>

                        <div
                          className={`ml-6 pl-2 border-l border-sidebar-border/60 space-y-0.5 overflow-hidden transition-all duration-300 ease-in-out ${
                            isOpen && isExpanded
                              ? "max-h-[1000px] mt-1 opacity-100"
                              : "max-h-0 opacity-0"
                          }`}
                        >
                          {item.subItems.map((sub) => {
                            const isSubActive = location.pathname === sub.path;
                            return (
                              <Link
                                key={sub.path}
                                to={sub.path}
                                className={`
                                  flex items-center justify-between h-7.5 px-2.5 rounded-md text-xs font-medium transition-all duration-200
                                  ${
                                    isSubActive
                                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-2xs font-semibold"
                                      : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/80"
                                  }
                                `}
                              >
                                <span className="truncate">{sub.label}</span>
                                {sub.label === "Role Assignments" &&
                                  isSuperAdmin &&
                                  pendingUsersCount > 0 && (
                                    <div className="flex-shrink-0 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1.5">
                                      {pendingUsersCount}
                                    </div>
                                  )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  const isMainActive =
                    location.pathname === item.path ||
                    (item.path !== "/" && location.pathname.startsWith(item.path + "/"));

                  return (
                    <Tooltip key={item.path} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.path!}
                          className={`
                            flex items-center h-8 tablet:h-8.5 overflow-hidden rounded-md text-xs transition-all duration-300 ease-in-out
                            ${isOpen ? "px-3 justify-start" : "px-0 justify-center"}
                            ${
                              isMainActive
                                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm font-semibold"
                                : "hover:bg-sidebar-accent text-sidebar-foreground font-medium"
                            }
                          `}
                        >
                          <div className="flex items-center justify-center flex-shrink-0 relative">
                            <Icon size={16} />
                          </div>
                          <div
                            className={`flex items-center justify-between min-w-0 ${
                              isOpen ? "flex-1" : "w-0"
                            }`}
                          >
                            <span
                              className={`text-xs font-medium transition-all duration-300 ease-in-out truncate ${
                                isOpen
                                  ? "opacity-100 ml-3 translate-x-0 w-auto"
                                  : "opacity-0 ml-0 -translate-x-4 w-0 overflow-hidden"
                              }`}
                            >
                              {item.label}
                            </span>
                          </div>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        sideOffset={10}
                        className={`font-semibold z-50 ${isOpen ? "hidden" : ""}`}
                      >
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </nav>
        </TooltipProvider>
      </aside>
    </>
  );
}
