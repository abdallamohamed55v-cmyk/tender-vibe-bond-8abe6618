import { Bell, CreditCard, Settings, Sparkles, Users, CheckCheck } from "lucide-react";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const typeConfig: Record<string, { icon: typeof Bell; className: string }> = {
  credits: { icon: CreditCard, className: "text-yellow-500" },
  system: { icon: Settings, className: "text-blue-500" },
  generation: { icon: Sparkles, className: "text-purple-500" },
  referral: { icon: Users, className: "text-green-500" },
};

const NotificationBell = () => {
  const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications();
  const navigate = useNavigate();

  const renderItem = (n: Notification) => {
    const config = typeConfig[n.type] || typeConfig.system;
    const Icon = config.icon;
    return (
      <button
        key={n.id}
        onClick={() => { markOneRead(n.id); }}
        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
          n.read ? "opacity-60" : "bg-accent/30"
        } hover:bg-accent/40 active:bg-accent/50`}
      >
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.className}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
          </p>
        </div>
        {!n.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
      </button>
    );
  };

  return (
    <Drawer direction="top">
      <DrawerTrigger asChild>
        <button
          className="relative flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors w-9 h-9"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[70vh]">
        <DrawerHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border">
          <DrawerTitle className="text-base font-semibold">Notifications</DrawerTitle>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <CheckCheck className="w-3 h-3" />
              Mark all read
            </button>
          )}
        </DrawerHeader>
        <div className="overflow-y-auto flex-1 divide-y divide-border">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No notifications</p>
          ) : (
            notifications.slice(0, 20).map(renderItem)
          )}
        </div>
        <div className="border-t border-border px-4 py-3">
          <button
            onClick={() => navigate("/settings/notifications")}
            className="text-xs text-primary hover:underline w-full text-center"
          >
            Notification settings
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default NotificationBell;
