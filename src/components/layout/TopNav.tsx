import { Bell, Search, Command, LogOut, User as UserIcon, Settings as SettingsIcon } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore, useUnreadCount } from "@/lib/store";
import { authService } from "@/services/api";
import { toast } from "sonner";

export function TopNav() {
  const user = useAuthStore((s) => s.user);
  const unread = useUnreadCount();
  const navigate = useNavigate();

  function handleLogout() {
    authService.logout();
    toast.success("Signed out");
    navigate({ to: "/auth/login" });
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/70 px-4 backdrop-blur-xl lg:px-6">
      <div className="flex flex-1 items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search resumes, roles, insights…"
            className="h-9 w-full rounded-lg border border-input bg-card/50 pl-9 pr-16 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <Command className="h-3 w-3" /> K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/50 text-muted-foreground transition hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-white">
              {unread}
            </span>
          )}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-border bg-card/50 pl-1 pr-3 py-1 transition hover:bg-card">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-[image:var(--gradient-primary)] text-[11px] text-white">
                {user?.avatarInitials ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left leading-tight sm:block">
              <div className="text-xs font-medium">{user?.name ?? "Guest"}</div>
              <div className="text-[10px] text-muted-foreground">{user?.plan ?? "Free"} plan</div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user?.email ?? "Not signed in"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile" className="cursor-pointer">
                <UserIcon className="mr-2 h-4 w-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">
                <SettingsIcon className="mr-2 h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
