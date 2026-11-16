import { ConnectionStatusLight } from "./ConnectionStatusLight";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Bell, Menu } from "lucide-react";
import { MessageHubStatusDropdown } from "./MessageHubStatusDropdown";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import ThemeSwitch from "./ThemeSwitch";
import { useAuth, type Role } from "@/lib/AuthContext";
import { resolveUserDepartment } from "@/lib/userDepartment";
import { useUnreadNotificationCount, useNotificationStream, isSilentNotification } from "@/hooks/useNotifications";
import { NotificationDropdownContent } from "./NotificationDropdown";
import { TopBarUserMenu, TopBarProfileDialog, TopBarLogoutDialog } from "./TopBarDialogs";

function TopBarClock() {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dayName = currentTime.toLocaleDateString("en-US", { weekday: "short" });
  const monthName = currentTime.toLocaleDateString("en-US", { month: "short" });
  const formattedDate = `${monthName}, ${currentTime.getDate()} ${currentTime.getFullYear()} (${dayName})`;
  const formattedTime = currentTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <div className="hidden laptop:flex flex-col items-end justify-center mr-1">
      <span className="text-xs font-bold text-foreground leading-tight tracking-tight">
        {formattedTime}
      </span>
      <span className="text-[10px] font-semibold text-muted-foreground mt-0.5">
        {formattedDate}
      </span>
    </div>
  );
}

function sendWindowsNotification(
  title: string,
  message: string,
  linkUrl?: string,
  onNavigate?: (url: string) => void
) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const notif = new Notification(title, {
      body: message,
      icon: "/favicon.svg",
      tag: `app-${Date.now()}`,
      silent: false,
    });

    notif.onclick = (e) => {
      e.preventDefault();
      try {
        window.focus();
      } catch {
        // Ignored
      }
      if (linkUrl) {
        if (onNavigate) {
          onNavigate(linkUrl);
        } else {
          window.location.href = linkUrl;
        }
      }
      notif.close();
    };
  } catch (err) {
    console.warn("Failed to show Windows desktop notification:", err);
  }
}

export default function TopBar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [inAppAlerts, setInAppAlerts] = useState(() => localStorage.getItem("inAppAlerts") !== "false");
  const [windowsNotifications, setWindowsNotifications] = useState(() => {
    const stored = localStorage.getItem("windowsNotifications");
    if (stored !== null) return stored === "true";
    return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
  });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default";
  });

  const handleToggleWindowsNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Desktop notifications are not supported by your browser.");
      return;
    }

    if (Notification.permission === "denied") {
      toast.error("Notifications are blocked by your browser settings. Please allow notifications in site settings.");
      return;
    }

    if (Notification.permission === "default") {
      try {
        const result = await Notification.requestPermission();
        setNotificationPermission(result);
        if (result === "granted") {
          setWindowsNotifications(true);
          localStorage.setItem("windowsNotifications", "true");
          sendWindowsNotification(
            "Notifications Enabled",
            "You will now receive desktop notifications for updates and activity."
          );
          toast.success("Desktop notifications enabled!");
        } else {
          setWindowsNotifications(false);
          localStorage.setItem("windowsNotifications", "false");
          toast.info("Notification permission was not granted.");
        }
      } catch (e) {
        console.error("Error requesting notification permission:", e);
      }
      return;
    }

    const nextVal = !windowsNotifications;
    setWindowsNotifications(nextVal);
    localStorage.setItem("windowsNotifications", String(nextVal));
    if (nextVal) {
      toast.success("Desktop notifications enabled");
    } else {
      toast.info("Desktop notifications disabled");
    }
  };

  const handleTestWindowsNotification = () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Desktop notifications are not supported.");
      return;
    }

    if (Notification.permission !== "granted") {
      handleToggleWindowsNotifications();
      return;
    }

    sendWindowsNotification(
      "Enterprise Portal",
      "This is a test notification! Desktop alerts are configured correctly.",
      "/sec-filings",
      (url) => navigate(url)
    );
    toast.success("Test notification sent!");
  };

  const navigate = useNavigate();
  const { user, roles, logout } = useAuth();

  const { data: allRoles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiClient.get<Role[]>("/api/configuration/roles").catch(() => []),
  });

  const profileDepartment =
    resolveUserDepartment({ ...user, roles }, allRoles) ||
    roles.map((r) => r.department).filter(Boolean).join(", ") ||
    (user?.department ? user.department : "") ||
    "General";

  const { data: unreadCountData } = useUnreadNotificationCount();
  const unreadCount = unreadCountData?.count ?? 0;

  const queryClient = useQueryClient();

  // Subscribes to the shared notification socket owned by useNotificationStream,
  // rather than opening a second connection of its own.
  const handleNotification = (newNotif: any) => {
    try {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });

      // Only display toast/desktop alerts if targeted to current user
      const currentUserId = user?.id || (user as any)?.sub;
      const isTargetUser =
        !newNotif.user_id ||
        newNotif.user_id === "*" ||
        (currentUserId && String(newNotif.user_id).toLowerCase() === String(currentUserId).toLowerCase()) ||
        (user?.email && String(newNotif.user_id).toLowerCase() === String(user.email).toLowerCase());

      if (!isTargetUser || isSilentNotification(newNotif)) {
        return;
      }

      const capitalizedTitle = newNotif.title ? newNotif.title.charAt(0).toUpperCase() + newNotif.title.slice(1) : "System Notification";

      if (inAppAlerts) {
        toast(
          <div
            className="cursor-pointer w-full flex flex-col gap-1"
            onClick={() => newNotif.link_url && navigate(newNotif.link_url)}
          >
            <div className="font-medium">{capitalizedTitle}</div>
            <div className="text-sm text-slate-500 dark:text-zinc-400 whitespace-pre-line">{newNotif.message}</div>
          </div>,
          {
            position: "bottom-right",
            duration: 5000,
            closeButton: true,
          }
        );
      }

      if (windowsNotifications && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        sendWindowsNotification(
          capitalizedTitle,
          newNotif.message || "New notification received",
          newNotif.link_url,
          (url) => navigate(url)
        );
      }
    } catch (err) {
      console.error("Failed to handle notification:", err);
    }
  };

  useNotificationStream({ onNotification: handleNotification });

  return (
    <header className="h-14 border-b border-border bg-card text-card-foreground flex items-center justify-between px-4 sm:px-6 shrink-0 transition-all duration-300 gap-3 sm:gap-4 relative z-40">
      <div className="flex-1 flex items-center min-w-0 gap-1.5">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="laptop:hidden h-7.5 w-7.5 text-muted-foreground hover:text-foreground shrink-0"
            title="Toggle Menu"
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3.5 md:gap-4.5 shrink-0">
        <MessageHubStatusDropdown />
        <ConnectionStatusLight />
        <TopBarClock />
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div><ThemeSwitch /></div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle Theme</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="hidden sm:flex items-center gap-1.5 border-r pr-2 sm:pr-4 md:pr-5 mr-1">
          <DropdownMenu open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground hover:bg-muted rounded-full h-8.5 w-8.5 outline-none focus-visible:ring-0">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-card" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[500px] max-w-[calc(100vw-1.5rem)] p-0 rounded-2xl overflow-hidden bg-card shadow-2xl border border-border">
              <NotificationDropdownContent onClose={() => setIsNotificationsOpen(false)} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <TopBarUserMenu
          user={user}
          roles={roles}
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenLogout={() => setIsLogoutOpen(true)}
        />
      </div>

      <TopBarProfileDialog
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
        user={user}
        roles={roles}
        profileDepartment={profileDepartment}
        inAppAlerts={inAppAlerts}
        onToggleInAppAlerts={() => {
          const newVal = !inAppAlerts;
          setInAppAlerts(newVal);
          localStorage.setItem("inAppAlerts", String(newVal));
        }}
        windowsNotifications={windowsNotifications}
        notificationPermission={notificationPermission}
        onToggleWindowsNotifications={handleToggleWindowsNotifications}
        onTestWindowsNotification={handleTestWindowsNotification}
      />

      <TopBarLogoutDialog
        open={isLogoutOpen}
        onOpenChange={setIsLogoutOpen}
        onConfirmLogout={() => {
          setIsLogoutOpen(false);
          logout();
        }}
      />
    </header>
  );
}
