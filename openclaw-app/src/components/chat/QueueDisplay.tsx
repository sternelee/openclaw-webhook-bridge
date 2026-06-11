/**
 * QueueDisplay - Shows queued messages when assistant is busy.
 * User can remove items from the queue.
 */

import type { ChatQueueItem } from "@/types";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

interface QueueDisplayProps {
  queue: ChatQueueItem[];
  onRemove: (id: string) => void;
}

export function QueueDisplay({ queue, onRemove }: QueueDisplayProps) {
  if (queue.length === 0) {
    return null;
  }

  return (
    <div
      className="border-t border-border/50 bg-muted/20 px-4 py-2"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icons.clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          Queued ({queue.length})
        </span>
      </div>
      <div className="space-y-1.5">
        {queue.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-2 p-2 rounded-lg bg-card/50 border border-border/30 hover:border-border/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground/90 line-clamp-2">
                {item.text ||
                  (item.attachments?.length
                    ? `Image (${item.attachments.length})`
                    : "")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(item.id)}
              className="shrink-0 h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
              aria-label="Remove from queue"
              title="Remove from queue"
            >
              <Icons.x className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
