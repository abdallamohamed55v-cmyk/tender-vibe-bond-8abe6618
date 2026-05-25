import { useState } from "react";
import { ChevronRight, MoreVertical, Plus, Share2, UserPlus, Pencil, Pin, Trash2 } from "lucide-react";
import { GlassSheet, GlassSheetContent } from "@/components/ui/glass-sheet";

export interface MobileChatHeaderProps {
  title?: string;
  hasConversation: boolean;
  isPinned?: boolean;
  onOpenSidebar: () => void;
  onNewChat: () => void;
  onShare: () => void;
  onInvite: () => void;
  onRename: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  rightSlot?: React.ReactNode;
}

export default function MobileChatHeader({
  hasConversation,
  isPinned,
  onOpenSidebar,
  onNewChat,
  onShare,
  onInvite,
  onRename,
  onTogglePin,
  onDelete,
  rightSlot,
}: MobileChatHeaderProps) {
  const [open, setOpen] = useState(false);

  const quickActions = [
    { icon: Share2, label: "Share", onClick: onShare },
    { icon: Pin, label: isPinned ? "Unpin" : "Pin chat", onClick: onTogglePin },
    { icon: Plus, label: "New chat", onClick: onNewChat },
  ];

  const listItems = [
    { icon: Pencil, label: "Rename conversation", onClick: onRename },
    { icon: UserPlus, label: "Invite people", onClick: onInvite },
  ];

  const run = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 60);
  };

  return (
    <>
      <div
        data-testid="mobile-chat-header"
        className="md:hidden fixed top-0 inset-x-0 z-30 flex items-center gap-2 px-3 py-1.5 min-h-[44px] pt-[max(env(safe-area-inset-top),0.25rem)] bg-transparent pointer-events-none [&>*]:pointer-events-auto"
      >
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          data-testid="mobile-open-sidebar"
          className="ios-fab w-11 h-11 rounded-full flex items-center justify-center text-foreground"
        >
          <ChevronRight className="mobile-header-icon-black w-[22px] h-[22px]" strokeWidth={2.25} />
        </button>

        <div className="flex-1 min-w-0 text-center">
          {!hasConversation ? rightSlot ?? null : null}
        </div>

        {hasConversation ? (
          <button
            type="button"
            aria-label="More options"
            data-testid="mobile-more-menu"
            onClick={() => setOpen(true)}
            className="ios-fab w-10 h-10 rounded-full flex items-center justify-center text-foreground"
          >
            <MoreVertical className="mobile-header-icon-black w-5 h-5" />
          </button>
        ) : (
          <span className="w-10 h-10 opacity-0 pointer-events-none" aria-hidden />
        )}
      </div>

      <GlassSheet open={open} onOpenChange={setOpen}>
        <GlassSheetContent data-testid="mobile-more-menu-content">
          <div className="space-y-3">
            {/* Primary actions card: top grid + list */}
            <div className="rounded-2xl overflow-hidden border border-foreground/5 bg-foreground/[0.04]">
              <div className="grid grid-cols-3 gap-1 p-2 border-b border-foreground/5">
                {quickActions.map(({ icon: Icon, label, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => run(onClick)}
                    data-testid={`mobile-menu-${label.toLowerCase().replace(/\s+/g, "-")}`}
                    className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl transition-colors hover:bg-foreground/10 active:bg-foreground/15"
                  >
                    <Icon className="w-6 h-6 text-primary" strokeWidth={2} />
                    <span className="text-[11px] font-medium text-foreground/70 uppercase tracking-wider">{label}</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col">
                {listItems.map(({ icon: Icon, label, onClick }, i) => (
                  <div key={label}>
                    {i !== 0 && <div className="h-px bg-foreground/5 mx-4" />}
                    <button
                      type="button"
                      onClick={() => run(onClick)}
                      data-testid={`mobile-menu-${label.toLowerCase().replace(/\s+/g, "-")}`}
                      className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-foreground/5 active:bg-foreground/10 text-foreground"
                    >
                      <Icon className="w-5 h-5 text-foreground/40 shrink-0" strokeWidth={2} />
                      <span className="flex-1 truncate text-[15px] font-medium">{label}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Destructive */}
            <div className="rounded-2xl overflow-hidden border border-foreground/5 bg-foreground/[0.04]">
              <button
                type="button"
                onClick={() => run(onDelete)}
                data-testid="mobile-menu-delete"
                className="w-full flex items-center gap-3 p-4 text-left text-[15px] font-semibold text-destructive transition-colors hover:bg-destructive/10 active:bg-destructive/15"
              >
                <Trash2 className="w-5 h-5 shrink-0" strokeWidth={2} />
                <span className="flex-1 truncate">Delete chat</span>
              </button>
            </div>

            {/* Cancel pill */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full py-4 bg-foreground/10 rounded-full text-foreground font-bold text-base active:scale-95 transition-transform"
            >
              Cancel
            </button>
          </div>
        </GlassSheetContent>
      </GlassSheet>
    </>
  );
}
