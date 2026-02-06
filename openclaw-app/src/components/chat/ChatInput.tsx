/**
 * ChatInput component for composing and sending messages.
 */

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Icons } from "@/components/ui/icons";
import { useAppStore } from "@/store/use-app-store";
import type { ChatAttachment } from "@/types";

interface ChatInputProps {
  onSend: (content: string) => void;
  onAbort?: () => void;
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onAbort,
  disabled = false,
  sending = false,
  placeholder = "Message (Enter to send, Shift+Enter for line breaks)",
}: ChatInputProps) {
  const { draft, setDraft, attachments, addAttachment, removeAttachment } = useAppStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isComposing, setIsComposing] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [draft]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = draft.trim();
    const hasAttachments = attachments.length > 0;

    if (!trimmed && !hasAttachments) return;
    if (disabled) return;

    onSend(trimmed);
    setDraft("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageItems: DataTransferItem[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        imageItems.push(item);
      }
    }

    if (imageItems.length === 0) return;

    e.preventDefault();

    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;

      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const dataUrl = reader.result as string;
        const newAttachment: ChatAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          dataUrl,
          mimeType: file.type,
          fileName: file.name,
        };
        addAttachment(newAttachment);
      });
      reader.readAsDataURL(file);
    }
  };

  const canSend = !disabled && (draft.trim().length > 0 || attachments.length > 0);
  const canAbort = sending && !!onAbort;

  return (
    <div className="border-t border-border/50 bg-card/50 p-4">
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="relative group rounded-lg overflow-hidden border border-border/50 bg-card"
            >
              <img src={att.dataUrl} alt={att.fileName} className="h-16 w-auto object-cover" />
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove attachment"
              >
                <Icons.x className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder={disabled ? "Connect to the gateway to start chatting…" : placeholder}
            disabled={disabled}
            className="min-h-[44px] max-h-[200px] resize-none pr-12"
            rows={1}
          />
          {/* Attachment hint */}
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground/50 pointer-events-none">
            {attachments.length > 0 && `${attachments.length} image${attachments.length > 1 ? "s" : ""}`}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {canAbort ? (
            <Button type="button" variant="destructive" onClick={onAbort} className="h-[44px]">
              <Icons.circle className="h-4 w-4 mr-2" />
              Stop
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              onClick={handleSend}
              disabled={!canSend}
              className="h-[44px]"
            >
              {sending ? (
                <>
                  <Icons.loaderSpin className="h-4 w-4 mr-2 animate-spin" />
                  Queue
                </>
              ) : (
                <>
                  Send
                  <kbd className="ml-2 px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                    ↵
                  </kbd>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Helper text */}
      <div className="mt-2 text-xs text-muted-foreground/70 flex items-center gap-2">
        <span>Paste images to attach</span>
        <span>•</span>
        <span>Shift+Enter for line breaks</span>
      </div>
    </div>
  );
}
