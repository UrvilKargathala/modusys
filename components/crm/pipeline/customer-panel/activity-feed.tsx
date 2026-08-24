"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, ArrowDown, Upload, Search, ChevronUp, ChevronDown, X, Star } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { MessageBubble } from "@/components/crm/pipeline/customer-panel/message-bubble";
import { MessageInput, type MessageInputHandle } from "@/components/crm/pipeline/customer-panel/message-input";
import { useCustomerMessages, type CustomerMessage } from "@/lib/store/customer-messages-store";
import { useChatPresence } from "@/lib/store/chat-presence-store";
import { useOrgUsers } from "@/lib/store/users-store";
import { cn } from "@/lib/utils";

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
  const presence = useChatPresence(customerId);
  const orgUsers = useOrgUsers();
  const typingNames = presence
    .filter((p) => p.isTyping)
    .map((p) => orgUsers.find((u) => u.id === p.userId)?.name)
    .filter((n): n is string => !!n);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchIdx, setMatchIdx] = useState(0);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const matches = useMemo(
    () =>
      searchQuery.trim()
        ? messages.filter((m) => m.kind !== "system" && m.text?.toLowerCase().includes(searchQuery.trim().toLowerCase()))
        : [],
    [messages, searchQuery]
  );

  // Clamp instead of resetting via effect — matches.length shrinks/grows as
  // the query changes, and clamping the *read* of matchIdx avoids a
  // setState-in-effect render cascade for what's just a derived bound.
  const currentMatchIdx = matches.length > 0 ? Math.min(matchIdx, matches.length - 1) : 0;

  const goToMatch = (idx: number) => {
    const m = matches[idx];
    if (!m) return;
    setMatchIdx(idx);
    messageRefs.current.get(m.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const nextMatches = value.trim()
      ? messages.filter((m) => m.kind !== "system" && m.text?.toLowerCase().includes(value.trim().toLowerCase()))
      : [];
    setMatchIdx(0);
    if (nextMatches.length > 0) {
      requestAnimationFrame(() => messageRefs.current.get(nextMatches[0].id)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  // messagesById stays keyed off the FULL thread (not the filtered list) so
  // a reply-to lookup still resolves when the original isn't starred.
  const [starredOnly, setStarredOnly] = useState(false);
  const visibleMessages = starredOnly ? messages.filter((m) => m.starred) : messages;

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

      {searchOpen ? (
        <div className="flex items-center gap-2 border-b border-grey-100 bg-card px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-grey-400" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches.length > 0) goToMatch((currentMatchIdx + 1) % matches.length);
              if (e.key === "Escape") closeSearch();
            }}
            placeholder="Search in this chat…"
            className="flex-1 bg-transparent text-sm font-body text-grey-800 outline-none placeholder:text-grey-300"
          />
          {searchQuery.trim() && (
            <span className="shrink-0 text-xs font-number text-grey-400">
              {matches.length > 0 ? `${currentMatchIdx + 1}/${matches.length}` : "0/0"}
            </span>
          )}
          <button type="button" onClick={() => goToMatch((currentMatchIdx - 1 + matches.length) % matches.length)} disabled={matches.length === 0} aria-label="Previous match" className="rounded p-1 text-grey-400 hover:bg-light-600 disabled:opacity-30">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => goToMatch((currentMatchIdx + 1) % matches.length)} disabled={matches.length === 0} aria-label="Next match" className="rounded p-1 text-grey-400 hover:bg-light-600 disabled:opacity-30">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button type="button" onClick={closeSearch} aria-label="Close search" className="rounded p-1 text-grey-400 hover:bg-light-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStarredOnly((v) => !v)}
            aria-label={starredOnly ? "Show all messages" : "Show starred messages"}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full shadow-sm",
              starredOnly ? "bg-warning-100 text-warning-900" : "bg-card text-grey-400 hover:text-warning-900"
            )}
          >
            <Star className={cn("h-4 w-4", starredOnly && "fill-warning-900")} />
          </button>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search in chat"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-grey-400 shadow-sm hover:text-primary"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      )}

      <div ref={scrollRef} onScroll={handleScroll} className="relative min-h-0 flex-1 overflow-y-auto p-4" style={{ backgroundImage: "url(/v748-toon-106.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}>
        {visibleMessages.length === 0 ? (
          <EmptyState icon={MessageCircle} message={starredOnly ? "No starred messages yet." : "No messages yet — start the conversation."} />
        ) : (
          <div className="flex flex-col gap-3">
            {visibleMessages.map((message, idx) => {
              const msgDate = new Date(message.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
              const prevDate = idx > 0 ? new Date(visibleMessages[idx - 1].createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null;
              const showDate = idx === 0 || msgDate !== prevDate;
              const isCurrentMatch = matches[currentMatchIdx]?.id === message.id;
              return (
                <div
                  key={message.id}
                  ref={(el) => {
                    if (el) messageRefs.current.set(message.id, el);
                    else messageRefs.current.delete(message.id);
                  }}
                  className={isCurrentMatch ? "-m-1 rounded-lg bg-warning-100/60 p-1 transition-colors" : undefined}
                >
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

      {typingNames.length > 0 && (
        <div className="px-4 pb-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-light-600 px-3 py-1 text-xs font-body italic text-grey-500">
            {typingNames.join(", ")} {typingNames.length > 1 ? "are" : "is"} typing…
          </span>
        </div>
      )}

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
