import { LogOut, User as UserIcon, BellRing, Settings2, Laptop } from "lucide-react";
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
import ThemeSwitch from "./ThemeSwitch";
import type { Role, User } from "@/lib/AuthContext";

interface TopBarUserMenuProps {
  user: User | null;
  roles: Role[];
  onOpenProfile: () => void;
  onOpenLogout: () => void;
}

/** User avatar dropdown menu in the top bar. */
export function TopBarUserMenu({ user, roles, onOpenProfile, onOpenLogout }: TopBarUserMenuProps) {
  const roleLabel = user?.is_super_admin ? "Super Admin" : roles.length > 0 ? roles[0].name : "Standard User";
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || user?.email || "User")}&background=eff6ff&color=2563eb&rounded=true&bold=true`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:bg-muted p-1.5 sm:p-2 sm:pr-3 rounded-xl transition-colors border border-transparent hover:border-border outline-none">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0 border border-border shadow-xs">
            <img src={avatarUrl} alt="User avatar" className="h-full w-full object-cover" />
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-sm font-bold text-foreground leading-tight">{user?.full_name || "User"}</span>
            <span className="text-[11px] font-medium text-muted-foreground mt-0.5">{roleLabel}</span>
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2">
        <div className="px-2 py-2 border-b border-border/50 pb-2.5 mb-1">
          <p className="text-sm font-semibold text-foreground leading-tight">{user?.full_name || "User"}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <Badge variant="secondary" className="h-5 inline-flex items-center justify-center px-2 text-[10px] font-medium leading-none">
              <span className="leading-none">{roleLabel}</span>
            </Badge>
          </div>
        </div>
        <DropdownMenuItem onClick={onOpenProfile} className="cursor-pointer text-xs">
          <UserIcon className="mr-2 h-3.5 w-3.5" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onOpenLogout}
          className="cursor-pointer text-xs text-red-600 focus:text-red-600 focus:bg-red-100 dark:focus:bg-red-900/30"
        >
          <LogOut className="mr-2 h-3.5 w-3.5" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface TopBarProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  roles: Role[];
  profileDepartment: string;
  inAppAlerts: boolean;
  onToggleInAppAlerts: () => void;
  windowsNotifications: boolean;
  notificationPermission: NotificationPermission;
  onToggleWindowsNotifications: () => void;
  onTestWindowsNotification: () => void;
}

/** Profile and notification preferences dialog opened from the top bar. */
export function TopBarProfileDialog({
  open,
  onOpenChange,
  user,
  roles,
  profileDepartment,
  inAppAlerts,
  onToggleInAppAlerts,
  windowsNotifications,
  notificationPermission,
  onToggleWindowsNotifications,
  onTestWindowsNotification,
}: TopBarProfileDialogProps) {
  const rolesText = user?.is_super_admin ? "Super Admin" : roles.length > 0 ? roles.map((r) => r.name).join(", ") : "Standard User";
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || user?.email || "User")}&background=eff6ff&color=2563eb&rounded=true&bold=true`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="w-[95vw] sm:max-w-[600px] p-0 overflow-hidden border-border/50 shadow-2xl rounded-2xl flex flex-col">
        <div className="bg-muted/30 border-b px-8 py-8 flex items-center gap-5">
          <div className="h-20 w-20 rounded-full border-2 border-border bg-muted overflow-hidden shadow-sm relative group">
            <img src={avatarUrl} alt="User avatar" className="h-full w-full object-cover" />
          </div>
          <div>
            <DialogTitle className="text-2xl font-bold">{user?.full_name || "User"}</DialogTitle>
            <DialogDescription className="text-sm mt-1">
              {user?.email} • {profileDepartment} • {rolesText}
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
              <ProfileGeneralTab user={user} profileDepartment={profileDepartment} rolesText={rolesText} />
            </TabsContent>
            <TabsContent value="preferences" className="space-y-6 mt-0 border-none outline-none">
              <ProfilePreferencesTab
                inAppAlerts={inAppAlerts}
                onToggleInAppAlerts={onToggleInAppAlerts}
                windowsNotifications={windowsNotifications}
                notificationPermission={notificationPermission}
                onToggleWindowsNotifications={onToggleWindowsNotifications}
                onTestWindowsNotification={onTestWindowsNotification}
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ProfileGeneralTab({ user, profileDepartment, rolesText }: { user: User | null; profileDepartment: string; rolesText: string }) {
  return (
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
          <Input readOnly value={rolesText} className="bg-muted/30 border-border text-muted-foreground h-11" />
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
  );
}

function ProfilePreferencesTab({
  inAppAlerts,
  onToggleInAppAlerts,
  windowsNotifications,
  notificationPermission,
  onToggleWindowsNotifications,
  onTestWindowsNotification,
}: {
  inAppAlerts: boolean;
  onToggleInAppAlerts: () => void;
  windowsNotifications: boolean;
  notificationPermission: NotificationPermission;
  onToggleWindowsNotifications: () => void;
  onTestWindowsNotification: () => void;
}) {
  const desktopEnabled = windowsNotifications && notificationPermission === "granted";

  return (
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
          className={`h-5 w-9 rounded-full relative cursor-pointer transition-colors ${inAppAlerts ? "bg-primary" : "bg-muted-foreground/30"}`}
          onClick={onToggleInAppAlerts}
        >
          <div className={`h-4 w-4 bg-background rounded-full absolute top-0.5 transition-all ${inAppAlerts ? "right-0.5" : "left-0.5"}`} />
        </div>
      </div>

      <div className="flex flex-col gap-2.5 p-3 rounded-lg border bg-card">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Laptop className="h-3.5 w-3.5" /> Desktop Notifications
            </Label>
            <p className="text-xs text-muted-foreground">Receive system toast alerts</p>
          </div>
          <div
            className={`h-5 w-9 rounded-full relative cursor-pointer transition-colors ${desktopEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
            onClick={onToggleWindowsNotifications}
          >
            <div className={`h-4 w-4 bg-background rounded-full absolute top-0.5 transition-all ${desktopEnabled ? "right-0.5" : "left-0.5"}`} />
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
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={onTestWindowsNotification}>
            Send Test Notification
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Logout confirmation dialog opened from the top bar user menu. */
export function TopBarLogoutDialog({
  open,
  onOpenChange,
  onConfirmLogout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmLogout: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl h-11 font-semibold">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirmLogout}
            className="flex-1 rounded-xl h-11 bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-lg transition-all font-semibold"
          >
            Log Out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
