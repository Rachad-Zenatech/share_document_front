import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Clock,
  Inbox,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useClearAllNotifications,
  type Notification,
} from "@/hooks/useNotifications";

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffSec / 86400);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationDropdownContent({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data: notifications = [], isLoading } = useNotifications();
  const { data: unreadCountData } = useUnreadNotificationCount();
  const unreadCount = unreadCountData?.count ?? 0;

  const markAsReadMutation = useMarkNotificationAsRead();
  const markAllAsReadMutation = useMarkAllNotificationsAsRead();
  const clearAllMutation = useClearAllNotifications();

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((n) => !n.is_read);
    }
    return notifications;
  }, [notifications, filter]);

  const handleNotificationClick = (item: Notification) => {
    if (!item.is_read) {
      markAsReadMutation.mutate(Number(item.id));
    }
    if (item.link_url) {
      onClose();
      navigate(item.link_url);
    }
  };

  return (
    <div className="flex flex-col h-[480px] max-h-[80vh]">
      {/* Header */}
      <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0.5 bg-primary/10 text-primary border-primary/20">
              {unreadCount} new
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Mark all read</span>
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-destructive"
              onClick={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending}
              title="Clear all notifications"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/40 px-4 pt-2 gap-4 text-xs font-medium bg-card">
        <button
          onClick={() => setFilter("all")}
          className={`pb-2 border-b-2 transition-colors cursor-pointer ${
            filter === "all"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`pb-2 border-b-2 transition-colors cursor-pointer ${
            filter === "unread"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/40">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Loading notifications...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <Inbox className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-xs font-medium">No notifications to display</p>
          </div>
        ) : (
          filteredNotifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`p-3.5 hover:bg-muted/40 transition-colors cursor-pointer flex gap-3 items-start ${
                !n.is_read ? "bg-primary/5 dark:bg-primary/10" : ""
              }`}
            >
              <div className="mt-1">
                {!n.is_read ? (
                  <span className="block h-2 w-2 rounded-full bg-primary" />
                ) : (
                  <span className="block h-2 w-2 rounded-full bg-transparent" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <h4 className="text-xs font-semibold text-foreground truncate">{n.title}</h4>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {formatRelativeTime(n.created_at)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{n.message}</p>
                {n.link_url && (
                  <div className="mt-1.5 flex items-center text-[10px] text-primary font-medium gap-1">
                    <span>View details</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
