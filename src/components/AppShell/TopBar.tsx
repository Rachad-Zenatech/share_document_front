import { ConnectionStatusLight } from "./ConnectionStatusLight";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Bell, Menu, LogOut, User as UserIcon, BellRing, Settings2, Laptop } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, BASE_URL } from "@/services/apiClient";
import ThemeSwitch from "./ThemeSwitch";
import { useAuth, type Role } from "@/lib/AuthContext";
import { resolveUserDepartment } from "@/lib/userDepartment";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { NotificationDropdownContent } from "./NotificationDropdown";

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

  useEffect(() => {
    // Connect to SSE stream
    const token = sessionStorage.getItem("token") || "";
    const eventSource = new EventSource(`${BASE_URL || ""}/api/notifications/stream?token=${token}`, { withCredentials: true });

    eventSource.onmessage = (event) => {
      try {
        const newNotif = JSON.parse(event.data);
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

        if (!isTargetUser) {
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
        console.error("Failed to parse SSE notification:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
    };

    return () => {
      eventSource.close();
    };
  }, [inAppAlerts, windowsNotifications, navigate, queryClient, user]);

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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:bg-muted p-1.5 sm:p-2 sm:pr-3 rounded-xl transition-colors border border-transparent hover:border-border outline-none">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0 border border-border shadow-xs">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || user?.email || "User")}&background=eff6ff&color=2563eb&rounded=true&bold=true`}
                  alt="User avatar"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-sm font-bold text-foreground leading-tight">{user?.full_name || "User"}</span>
                <span className="text-[11px] font-medium text-muted-foreground mt-0.5">
                  {user?.is_super_admin ? "Super Admin" : roles.length > 0 ? roles[0].name : "Standard User"}
                </span>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-2">
            <div className="px-2 py-2 border-b border-border/50 pb-2.5 mb-1">
              <p className="text-sm font-semibold text-foreground leading-tight">{user?.full_name || "User"}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email}</p>

              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <Badge variant="secondary" className="h-5 inline-flex items-center justify-center px-2 text-[10px] font-medium leading-none">
                  <span className="leading-none">{user?.is_super_admin ? "Super Admin" : roles.length > 0 ? roles[0].name : "Standard User"}</span>
                </Badge>
              </div>
            </div>
            <DropdownMenuItem onClick={() => setIsProfileOpen(true)} className="cursor-pointer text-xs">
              <UserIcon className="mr-2 h-3.5 w-3.5" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setIsLogoutOpen(true)}
              className="cursor-pointer text-xs text-red-600 focus:text-red-600 focus:bg-red-100 dark:focus:bg-red-900/30"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent aria-describedby={undefined} className="w-[95vw] sm:max-w-[600px] p-0 overflow-hidden border-border/50 shadow-2xl rounded-2xl flex flex-col">
          <div className="bg-muted/30 border-b px-8 py-8 flex items-center gap-5">
            <div className="h-20 w-20 rounded-full border-2 border-border bg-muted overflow-hidden shadow-sm relative group">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || user?.email || "User")}&background=eff6ff&color=2563eb&rounded=true&bold=true`}
                alt="User avatar"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold">{user?.full_name || "User"}</DialogTitle>
              <DialogDescription className="text-sm mt-1">
                {user?.email} • {profileDepartment} • {user?.is_super_admin ? "Super Admin" : roles.length > 0 ? roles.map(r => r.name).join(", ") : "Standard User"}
              </DialogDescription>
            </div>
          </div>

          <Tabs defaultValue="general" className="w-full flex-1 flex flex-col">
            <div className="px-8 pt-6">
              <TabsList className="grid w-full grid-cols-2 h-11 bg-muted/50">
                <TabsTrigger value="general" className="rounded-md font-semibold text-xs uppercase tracking-wider">General</TabsTrigger>
                <TabsTrigger value="preferences" className="rounded-md font-semibold text-xs uppercase tracking-wider">Preferences</TabsTrigger>
              </TabsList>
            </div>

            <div className="px-8 py-6 flex-1 overflow-y-auto max-h-[60vh]">
              <TabsContent value="general" className="space-y-6 mt-0 border-none outline-none">
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name</Label>
                    <Input id="fullName" readOnly defaultValue={user?.full_name || ""} className="bg-muted/30 border-border h-11" />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department</Label>
                      <Input readOnly value={profileDepartment} className="bg-muted/30 border-border text-muted-foreground h-11" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Roles</Label>
                      <Input readOnly value={user?.is_super_admin ? "Super Admin" : roles.length > 0 ? roles.map(r => r.name).join(", ") : "Standard User"} className="bg-muted/30 border-border text-muted-foreground h-11" />
                    </div>
                  </div>

                  {user?.job_title && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Job Title</Label>
                      <Input readOnly value={user.job_title} className="bg-muted/30 border-border text-muted-foreground h-11" />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</Label>
                    <Input id="email" type="text" readOnly defaultValue={user?.email || ""} className="bg-muted/30 border-border h-10" />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preferences" className="space-y-6 mt-0 border-none outline-none">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" /> App Settings
                  </h4>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Theme Preference</Label>
                      <p className="text-xs text-muted-foreground">Select your preferred interface theme</p>
                    </div>
                    <ThemeSwitch />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <BellRing className="h-3.5 w-3.5" /> In-App Alerts
                      </Label>
                      <p className="text-xs text-muted-foreground">Show in-app toast popups</p>
                    </div>
                    <div
                      className={`h-5 w-9 rounded-full relative cursor-pointer transition-colors ${inAppAlerts ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                      onClick={() => {
                        const newVal = !inAppAlerts;
                        setInAppAlerts(newVal);
                        localStorage.setItem("inAppAlerts", String(newVal));
                      }}
                    >
                      <div className={`h-4 w-4 bg-background rounded-full absolute top-0.5 transition-all ${inAppAlerts ? 'right-0.5' : 'left-0.5'}`} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 p-3 rounded-lg border bg-card">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium flex items-center gap-1.5">
                          <Laptop className="h-3.5 w-3.5" /> Desktop Notifications
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Receive system toast alerts
                        </p>
                      </div>
                      <div
                        className={`h-5 w-9 rounded-full relative cursor-pointer transition-colors ${
                          windowsNotifications && notificationPermission === "granted"
                            ? 'bg-primary'
                            : 'bg-muted-foreground/30'
                        }`}
                        onClick={handleToggleWindowsNotifications}
                      >
                        <div
                          className={`h-4 w-4 bg-background rounded-full absolute top-0.5 transition-all ${
                            windowsNotifications && notificationPermission === "granted"
                              ? 'right-0.5'
                              : 'left-0.5'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Permission:</span>
                        {notificationPermission === "granted" ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-600 dark:text-green-400 bg-green-500/10">
                            Granted
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                            Needs Permission
                          </Badge>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2.5"
                        onClick={handleTestWindowsNotification}
                      >
                        Send Test Notification
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={isLogoutOpen} onOpenChange={setIsLogoutOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-[425px] outline-none">
          <DialogHeader className="flex flex-col items-center space-y-4 pt-4">
            <div className="h-16 w-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center">
              <LogOut className="h-8 w-8 ml-1" />
            </div>
            <DialogTitle className="text-xl text-center">Log Out</DialogTitle>
            <DialogDescription className="text-center px-2">
              Are you sure you want to log out of your account? You will need to sign back in to access the portal.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-3 sm:justify-center mt-4 pb-2 px-2">
            <Button variant="outline" onClick={() => setIsLogoutOpen(false)} className="flex-1 rounded-xl h-11 font-semibold">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setIsLogoutOpen(false);
                logout();
              }}
              className="flex-1 rounded-xl h-11 bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-lg transition-all font-semibold"
            >
              Log Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
