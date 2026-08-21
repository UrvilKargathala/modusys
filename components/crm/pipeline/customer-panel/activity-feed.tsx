"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, ArrowDown, Upload } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { MessageBubble } from "@/components/crm/pipeline/customer-panel/message-bubble";
import { MessageInput, type MessageInputHandle } from "@/components/crm/pipeline/customer-panel/message-input";
import { useCustomerMessages, type CustomerMessage } from "@/lib/store/customer-messages-store";

export function ActivityFeed({ customerId }: { customerId: string }) {
  const messages = useCustomerMessages(customerId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<MessageInputHandle>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const dragCounter = useRef(0);
  const prevCount = useRef(messages.length);
  // Reply target is composer-level state; each bubble's "Reply" action sets
  // it, the composer reads it. Kept here (common ancestor) instead of a
  // store so it resets automatically when the customer panel unmounts.
  const [replyTarget, setReplyTarget] = useState<{ message: CustomerMessage; imageIndex?: number } | null>(null);
  const messagesById = new Map(messages.map((m) => [m.id, m]));

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCounter.current += 1;
    setDragActive(true);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragActive(false);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      messageInputRef.current?.attachFiles(e.dataTransfer.files);
    }
  };

  useEffect(() => {
    fetch(`/api/customers/${customerId}/messages/read-receipts`, { method: "POST" }).catch(() => {});
  }, [customerId, messages.length]);

  useEffect(() => {
    const grew = messages.length > prevCount.current;
    prevCount.current = messages.length;
    if (!grew) return;

    if (!userScrolledUp) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length, userScrolledUp]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setUserScrolledUp(distanceFromBottom > 120);
  };

  const jumpToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    setUserScrolledUp(false);
  };

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
          <Upload className="h-8 w-8 text-primary" />
          <span className="text-sm font-body font-medium text-primary">Drop files to attach</span>
        </div>
      )}
      <div ref={scrollRef} onScroll={handleScroll} className="relative min-h-0 flex-1 overflow-y-auto p-4" style={{ backgroundImage: "url(/v748-toon-106.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}>
        {messages.length === 0 ? (
          <EmptyState icon={MessageCircle} message="No messages yet — start the conversation." />
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message, idx) => {
              const msgDate = new Date(message.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
              const prevDate = idx > 0 ? new Date(messages[idx - 1].createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null;
              const showDate = idx === 0 || msgDate !== prevDate;
              return (
                <div key={message.id}>
                  {showDate && (
                    <div className="flex justify-center py-2">
                      <span className="rounded-full bg-grey-100 px-3 py-0.5 text-[11px] font-body font-medium text-grey-500">
                        {msgDate}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={message}
                    replyTo={message.replyToMessageId ? messagesById.get(message.replyToMessageId) ?? null : null}
                    replyToImageIndex={message.replyToImageIndex}
                    onReply={(imageIndex?: number) => setReplyTarget({ message, imageIndex })}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {userScrolledUp && messages.length > 0 && (
        <div className="flex justify-center pb-1">
          <button
            type="button"
            onClick={jumpToBottom}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-body font-medium text-white shadow-md"
          >
            New messages <ArrowDown className="h-3 w-3" />
          </button>
        </div>
      )}

      <MessageInput
        ref={messageInputRef}
        customerId={customerId}
        replyTarget={replyTarget?.message ?? null}
        replyImageIndex={replyTarget?.imageIndex}
        onClearReply={() => setReplyTarget(null)}
      />
    </div>
  );
}
