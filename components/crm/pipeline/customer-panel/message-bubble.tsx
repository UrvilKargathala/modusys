"use client";

import { Clock, AlertCircle, RotateCcw, Play, Pause, MoreVertical, Copy, Pencil, Trash2, Check, CheckCheck, X as XIcon, FileText, ListTodo, Reply, Download, Info, Star, Forward, SmilePlus, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MessageText } from "@/components/crm/pipeline/customer-panel/message-text";
import { customerMessagesStore, useReadSummary, type CustomerMessage } from "@/lib/store/customer-messages-store";
import { useOrgUsers } from "@/lib/store/users-store";
import { CURRENT_USER_ID } from "@/lib/session";
import { toastStore } from "@/lib/store/toast-store";
import { ForwardDialog } from "@/components/crm/pipeline/customer-panel/forward-dialog";
import { cn } from "@/lib/utils";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏", "🎉"];

function timeAgo(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function VoiceBubble({ message }: { message: CustomerMessage }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const bars = useRef(Array.from({ length: 24 }, () => 20 + Math.random() * 80)).current;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          if (playing) audioRef.current?.pause();
          else audioRef.current?.play();
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal text-grey-900"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
      </button>
      <div className="flex h-6 flex-1 items-center gap-0.5">
        {bars.map((h, i) => (
          <span key={i} className="w-0.5 rounded-full bg-primary-300" style={{ height: `${h}%` }} />
        ))}
      </div>
      <span className="text-xs font-number text-grey-400">
        0:{String(message.durationSec ?? 0).padStart(2, "0")}
      </span>
      <audio
        ref={audioRef}
        src={message.audioUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </div>
  );
}

function MessageInfo({ message, orgUsers, onClose }: { message: CustomerMessage; orgUsers: { id: string; name: string }[]; onClose: () => void }) {
  const sender = orgUsers.find((u) => u.id === message.senderId);
  const date = new Date(message.createdAt);
  const dateStr = date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  const imageCount = message.imageUrls?.length || (message.imageUrl ? 1 : 0);
  const fileNames = message.imageNames?.length ? message.imageNames : message.imageName ? [message.imageName] : [];

  const [seenBy, setSeenBy] = useState<{ userId: string; readAt: string }[]>([]);
  const [loadingSeen, setLoadingSeen] = useState(true);

  useEffect(() => {
    if (message.status !== "sent") { setLoadingSeen(false); return; }
    fetch(`/api/customers/${message.customerId}/messages/read-receipts?messageId=${message.id}`)
      .then((r) => r.json())
      .then((d) => setSeenBy(d.receipts ?? []))
      .catch(() => {})
      .finally(() => setLoadingSeen(false));
  }, [message.id, message.customerId, message.status]);

  const rows: [string, React.ReactNode][] = [
    ["From", sender?.name ?? "Unknown"],
    ["Date", dateStr],
    ["Time", timeStr],
    [
      "Type",
      message.kind === "chat"
        ? "Text"
        : message.kind === "image"
        ? <>Photo{imageCount > 1 ? <> (<span className="font-number">{imageCount}</span>)</> : ""}</>
        : message.kind === "pdf"
        ? "PDF"
        : message.kind === "voice"
        ? "Voice note"
        : "System",
    ],
  ];
  if (message.kind === "pdf" && message.pdfName) rows.push(["File", message.pdfName]);
  if (message.kind === "pdf" && typeof message.pdfSize === "number") rows.push(["Size", `${(message.pdfSize / 1024 / 1024).toFixed(2)} MB`]);
  if (fileNames.length > 0) rows.push(["File(s)", fileNames.join(", ")]);
  if (message.kind === "voice" && message.durationSec) rows.push(["Duration", `0:${String(message.durationSec).padStart(2, "0")}`]);
  if (message.editedAt) rows.push(["Edited", new Date(message.editedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })]);

  const numberRowLabels = new Set(["Date", "Time", "Size", "Duration", "Edited"]);

  const seenUsers = seenBy
    .filter((r) => r.userId !== message.senderId)
    .map((r) => ({
      name: orgUsers.find((u) => u.id === r.userId)?.name ?? "Unknown",
      at: new Date(r.readAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }),
    }));

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xs rounded-xl border border-grey-100 bg-card p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-heading text-sm font-semibold text-grey-900">Message Info</span>
          <button type="button" onClick={onClose} className="rounded p-1 text-grey-400 hover:bg-light-600 hover:text-grey-700">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-xs font-body text-grey-400">{label}</span>
              <span className={cn("text-right text-xs font-body font-medium text-grey-700", numberRowLabels.has(label) && "font-number")}>{value}</span>
            </div>
          ))}
        </div>

        {message.status === "sent" && (
          <div className="mt-3 border-t border-grey-100 pt-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-secondary" />
              <span className="text-xs font-body font-medium text-grey-700">Seen by</span>
            </div>
            {loadingSeen ? (
              <span className="text-[11px] font-body text-grey-400">Loading…</span>
            ) : seenUsers.length === 0 ? (
              <span className="text-[11px] font-body text-grey-400">No one yet</span>
            ) : (
              <div className="flex flex-col gap-1.5">
                {seenUsers.map((s) => (
                  <div key={s.name + s.at} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-body font-medium text-grey-700">{s.name}</span>
                    <span className="text-[11px] font-number text-grey-400">{s.at}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReactionPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  return (
    <div ref={rootRef} className="absolute z-20 mt-1 flex gap-0.5 rounded-full border border-grey-100 bg-card px-1.5 py-1 shadow-md">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => { onPick(emoji); onClose(); }}
          className="rounded-full p-1 text-base hover:scale-125 hover:bg-light-600"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

function ReactionPills({ message, isSelf }: { message: CustomerMessage; isSelf: boolean }) {
  const reactions = message.reactions ?? [];
  if (reactions.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1 pt-0.5", isSelf && "justify-end")}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => customerMessagesStore.toggleReaction(message.customerId, message.id, r.emoji, CURRENT_USER_ID)}
          className={cn(
            "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs",
            r.reactedByMe ? "border-primary bg-primary-transparent" : "border-grey-100 bg-light-600"
          )}
        >
          <span>{r.emoji}</span>
          <span className="font-number text-[10px] text-grey-600">{r.count}</span>
        </button>
      ))}
    </div>
  );
}

function MessageActions({
  message,
  isSelf,
  onEdit,
  onReply,
}: {
  message: CustomerMessage;
  isSelf: boolean;
  onEdit: () => void;
  onReply?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const orgUsers = useOrgUsers();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const canCopy = !!message.text || message.kind === "image";
  const canEdit = isSelf && message.kind === "chat" && !!message.text;
  const canDeleteEveryone = isSelf && message.status === "sent";
  const canDeleteMe = message.status === "sent";
  const canReply = !!onReply && message.status !== "pending";
  const canReact = message.status === "sent";
  const canForward = message.status === "sent";
  const isStarred = !!message.starred;
  // Download only makes sense for real (sent) attachment messages.
  const downloadUrls: { url: string; name?: string }[] =
    message.status !== "sent"
      ? []
      : message.kind === "image"
      ? (message.imageUrls && message.imageUrls.length > 0
          ? message.imageUrls.map((url, i) => ({ url, name: message.imageNames?.[i] }))
          : message.imageUrl
          ? [{ url: message.imageUrl, name: message.imageName }]
          : [])
      : message.kind === "pdf" && message.pdfUrl
      ? [{ url: message.pdfUrl, name: message.pdfName }]
      : message.kind === "voice" && message.audioUrl
      ? [{ url: message.audioUrl, name: `voice-${message.id}.webm` }]
      : [];
  const canDownload = downloadUrls.length > 0;

  if (!canCopy && !canEdit && !canDeleteMe && !canReply && !canDownload && !canReact && !canForward) return null;

  const copy = async () => {
    try {
      if (message.text) await navigator.clipboard.writeText(message.text);
      else if (message.imageUrl) await navigator.clipboard.writeText(message.imageUrl);
      toastStore.show("Copied");
    } catch {
      toastStore.show("Copy failed", "error");
    }
    setOpen(false);
  };

  const delForMe = () => {
    customerMessagesStore.deleteMessage(message.customerId, message.id, "me");
    setOpen(false);
  };

  const delForEveryone = () => {
    if (!confirm("Delete this message for everyone?")) {
      setOpen(false);
      return;
    }
    customerMessagesStore.deleteMessage(message.customerId, message.id, "everyone");
    setOpen(false);
  };

  const star = () => {
    customerMessagesStore.toggleStar(message.customerId, message.id);
    setOpen(false);
  };

  const download = async () => {
    setOpen(false);
    try {
      // Fetch as blob so cross-origin URLs (Vercel Blob) actually download
      // instead of navigating away. Chrome silently blocks automatic
      // downloads past ~10 in a tight loop (anti-abuse throttling), so each
      // click is spaced out instead of firing back-to-back.
      for (let i = 0; i < downloadUrls.length; i++) {
        const { url, name } = downloadUrls[i];
        const res = await fetch(url);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = name || url.substring(url.lastIndexOf("/") + 1) || "download";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
        if (i < downloadUrls.length - 1) await new Promise((r) => setTimeout(r, 400));
      }
      toastStore.show(downloadUrls.length > 1 ? `Downloaded ${downloadUrls.length} files` : "Downloaded", "success");
    } catch {
      toastStore.show("Download failed", "error");
    }
  };

  return (
    <div ref={rootRef} className="relative flex items-center gap-0.5">
      {canReact && (
        <button
          type="button"
          aria-label="React"
          onClick={() => setShowReactionPicker((o) => !o)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-grey-400 opacity-0 transition-opacity hover:bg-light-600 hover:text-grey-700 group-hover:opacity-100 data-[open=true]:opacity-100"
          data-open={showReactionPicker}
        >
          <SmilePlus className="h-3.5 w-3.5" />
        </button>
      )}
      {showReactionPicker && (
        <ReactionPicker
          onClose={() => setShowReactionPicker(false)}
          onPick={(emoji) => customerMessagesStore.toggleReaction(message.customerId, message.id, emoji, CURRENT_USER_ID)}
        />
      )}
      <button
        type="button"
        aria-label="Message actions"
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 w-6 items-center justify-center rounded-full text-grey-400 opacity-0 transition-opacity hover:bg-light-600 hover:text-grey-700 group-hover:opacity-100 data-[open=true]:opacity-100"
        data-open={open}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className={cn(
          "absolute z-10 mt-1 flex w-44 flex-col overflow-hidden rounded-lg border border-grey-100 bg-card py-1 shadow-lg",
          isSelf ? "right-0" : "left-0"
        )}>
          {canReply && (
            <button
              type="button"
              onClick={() => { onReply?.(); setOpen(false); }}
              className="flex items-center gap-2.5 px-3 py-2 text-left text-xs font-body text-grey-700 hover:bg-light-600"
            >
              <Reply className="h-3.5 w-3.5 shrink-0 text-grey-400" />
              Reply
            </button>
          )}
          {canCopy && (
            <button type="button" onClick={copy} className="flex items-center gap-2.5 px-3 py-2 text-left text-xs font-body text-grey-700 hover:bg-light-600">
              <Copy className="h-3.5 w-3.5 shrink-0 text-grey-400" />
              Copy
            </button>
          )}
          {canDownload && (
            <button type="button" onClick={download} className="flex items-center gap-2.5 px-3 py-2 text-left text-xs font-body text-grey-700 hover:bg-light-600">
              <Download className="h-3.5 w-3.5 shrink-0 text-grey-400" />
              Download{downloadUrls.length > 1 ? <> (<span className="font-number">{downloadUrls.length}</span>)</> : ""}
            </button>
          )}
          {canForward && (
            <button type="button" onClick={() => { setShowForward(true); setOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-left text-xs font-body text-grey-700 hover:bg-light-600">
              <Forward className="h-3.5 w-3.5 shrink-0 text-grey-400" />
              Forward
            </button>
          )}
          {message.status === "sent" && (
            <button type="button" onClick={star} className="flex items-center gap-2.5 px-3 py-2 text-left text-xs font-body text-grey-700 hover:bg-light-600">
              <Star className={cn("h-3.5 w-3.5 shrink-0", isStarred ? "fill-warning-900 text-warning-900" : "text-grey-400")} />
              {isStarred ? "Unstar" : "Star"}
            </button>
          )}
          <button type="button" onClick={() => { setShowInfo(true); setOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-left text-xs font-body text-grey-700 hover:bg-light-600">
            <Info className="h-3.5 w-3.5 shrink-0 text-grey-400" />
            Info
          </button>
          {canEdit && (
            <button type="button" onClick={() => { onEdit(); setOpen(false); }} className="flex items-center gap-2.5 px-3 py-2 text-left text-xs font-body text-grey-700 hover:bg-light-600">
              <Pencil className="h-3.5 w-3.5 shrink-0 text-grey-400" />
              Edit
            </button>
          )}
          {(canDeleteMe || canDeleteEveryone) && <div className="my-1 border-t border-grey-100" />}
          {canDeleteMe && (
            <button type="button" onClick={delForMe} className="flex items-center gap-2.5 px-3 py-2 text-left text-xs font-body text-error hover:bg-error-transparent">
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              Delete for me
            </button>
          )}
          {canDeleteEveryone && (
            <button type="button" onClick={delForEveryone} className="flex items-center gap-2.5 px-3 py-2 text-left text-xs font-body text-error hover:bg-error-transparent">
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              Delete for everyone
            </button>
          )}
        </div>
      )}
      {showInfo && <MessageInfo message={message} orgUsers={orgUsers} onClose={() => setShowInfo(false)} />}
      {showForward && <ForwardDialog customerId={message.customerId} messageId={message.id} onClose={() => setShowForward(false)} />}
    </div>
  );
}

export function MessageBubble({
  message,
  replyTo,
  replyToImageIndex,
  onReply,
  onOpenImage,
}: {
  message: CustomerMessage;
  replyTo?: CustomerMessage | null;
  replyToImageIndex?: number;
  onReply?: (imageIndex?: number) => void;
  // When provided, image clicks open a lightbox scrolling through every
  // image in the whole conversation (WhatsApp-style) instead of just this
  // message's own group — see ImageGallery below.
  onOpenImage?: (key: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text ?? "");
  // Hooks must run unconditionally — called here, above the "system" early
  // return below, rather than after it (was already the case for useOrgUsers
  // before useReadSummary was added alongside it).
  const orgUsers = useOrgUsers();
  const readSummary = useReadSummary(message.customerId);

  if (message.kind === "system") {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-light-600 px-3 py-1 text-xs font-body text-grey-400">
          {message.text} · <span className="font-number">{timeAgo(message.createdAt)}</span>
        </span>
      </div>
    );
  }

  const sender = orgUsers.find((u) => u.id === message.senderId);
  const isSelf = message.senderId === CURRENT_USER_ID;
  // Seen once any OTHER user's lastReadAt is >= this message's createdAt —
  // aggregate summary (see useReadSummary) instead of a per-message fetch.
  const seenByOthers =
    isSelf &&
    message.status === "sent" &&
    readSummary.some((r) => r.userId !== message.senderId && r.lastReadAt && r.lastReadAt >= message.createdAt);

  const saveEdit = () => {
    const next = draft.trim();
    if (next && next !== message.text) customerMessagesStore.editMessage(message.customerId, message.id, next);
    setEditing(false);
  };

  return (
    <div className={cn("group flex gap-2", isSelf ? "flex-row-reverse" : "flex-row")}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-transparent text-xs font-medium text-primary">
        {sender?.name?.[0] ?? "?"}
      </span>
      <div className={cn("flex min-w-0 max-w-[75%] flex-col gap-0.5", isSelf ? "items-end" : "items-start")}>
        <div className={cn("flex items-center gap-1", isSelf && "flex-row-reverse")}>
          <span className="text-xs font-body font-medium text-grey-500">{sender?.name ?? "Unknown"}</span>
          <MessageActions
            message={message}
            isSelf={isSelf}
            onEdit={() => {
              setDraft(message.text ?? "");
              setEditing(true);
            }}
            onReply={onReply}
          />
        </div>
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm font-body",
            isSelf ? "bg-teal text-grey-900" : "bg-light-600 text-grey-800",
            message.status === "error" && "border border-error",
            message.kind === "image" && "p-1.5"
          )}
        >
          {message.isForwarded && (
            <div className={cn("mb-1 flex items-center gap-1 text-[11px] italic", isSelf ? "text-grey-700/70" : "text-grey-400")}>
              <Forward className="h-3 w-3" />
              Forwarded
            </div>
          )}
          {replyTo && (
            <ReplyQuote message={replyTo} isSelf={isSelf} imageIndex={replyToImageIndex} />
          )}
          {message.kind === "voice" ? (
            <VoiceBubble message={message} />
          ) : message.kind === "image" ? (
            <ImageGallery message={message} onReply={onReply} onOpenImage={onOpenImage} />
          ) : message.kind === "pdf" ? (
            <PdfBubble message={message} />
          ) : editing ? (
            <div className="flex items-center gap-1">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    saveEdit();
                  }
                  if (e.key === "Escape") setEditing(false);
                }}
                autoFocus
                rows={1}
                className="min-w-40 resize-none rounded-md bg-white/60 px-2 py-1 text-sm text-grey-900 outline-none"
              />
              <button type="button" aria-label="Save" onClick={saveEdit} className="rounded p-1 text-grey-700 hover:bg-white/40">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button type="button" aria-label="Cancel" onClick={() => setEditing(false)} className="rounded p-1 text-grey-700 hover:bg-white/40">
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <MessageText text={message.text ?? ""} inverted={isSelf} />
          )}
        </div>
        <ReactionPills message={message} isSelf={isSelf} />
        {message.status === "sent" && message.mentionedUserIds && message.mentionedUserIds.length > 0 && (
          <div className={cn("flex flex-wrap gap-1 pt-1", isSelf && "justify-end")}>
            {message.mentionedUserIds
              .filter((id) => id !== message.senderId)
              .map((mentionedId) => {
                const u = orgUsers.find((x) => x.id === mentionedId);
                if (!u) return null;
                return (
                  <Link
                    key={mentionedId}
                    href="/crm?tab=tasks"
                    className="inline-flex items-center gap-1 rounded-full bg-primary-transparent px-2 py-0.5 text-[10px] font-body font-medium text-primary hover:bg-primary/20"
                    title={`A task was assigned to ${u.name}`}
                  >
                    <ListTodo className="h-3 w-3" />
                    Task → {u.name}
                  </Link>
                );
              })}
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[11px] font-number text-grey-300">
          {message.status === "pending" && (
            <>
              <Clock className="h-3 w-3" /> Sending…
            </>
          )}
          {message.status === "error" && (
            <button
              type="button"
              onClick={() => customerMessagesStore.retryMessage(message.customerId, message.id)}
              className="flex items-center gap-1 text-error hover:underline"
            >
              <AlertCircle className="h-3 w-3" /> Failed — tap to retry <RotateCcw className="h-3 w-3" />
            </button>
          )}
          {message.status === "sent" && (
            <>
              {message.starred && <Star className="h-3 w-3 fill-warning-900 text-warning-900" />}
              {timeAgo(message.createdAt)}
              {message.editedAt && <span className="italic text-grey-400">(edited)</span>}
              {isSelf &&
                (seenByOthers ? (
                  <CheckCheck className="h-3.5 w-3.5 text-secondary" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-grey-300" />
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PdfBubble({ message }: { message: CustomerMessage }) {
  const [open, setOpen] = useState(false);
  if (!message.pdfUrl) return null;
  const sizeLabel =
    typeof message.pdfSize === "number" ? (
      <>PDF · <span className="font-number">{(message.pdfSize / 1024 / 1024).toFixed(2)} MB</span></>
    ) : (
      "PDF"
    );
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md bg-white/40 px-2.5 py-1.5 text-left hover:bg-white/60"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-error text-white">
          <FileText className="h-4 w-4" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="line-clamp-2 break-all text-sm font-body font-medium">{message.pdfName ?? "Document.pdf"}</span>
          <span className="text-[11px] font-body text-grey-500">{sizeLabel}</span>
        </span>
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-card shadow-xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-grey-100 px-4 py-2.5">
              <span className="truncate font-heading text-sm font-semibold text-grey-900">
                {message.pdfName ?? "Document.pdf"}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={message.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-body font-medium text-primary hover:underline"
                >
                  Open in new tab
                </a>
                <button
                  type="button"
                  aria-label="Close preview"
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1.5 text-grey-500 hover:bg-light-600 hover:text-grey-900"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            <iframe
              src={message.pdfUrl}
              title={message.pdfName ?? "PDF preview"}
              className="min-h-0 flex-1 bg-white"
            />
          </div>
        </div>
      )}
    </>
  );
}

function ImageGallery({
  message,
  onReply,
  onOpenImage,
}: {
  message: CustomerMessage;
  onReply?: (imageIndex?: number) => void;
  onOpenImage?: (key: string) => void;
}) {
  const urls =
    message.imageUrls && message.imageUrls.length > 0
      ? message.imageUrls
      : message.imageUrl
      ? [message.imageUrl]
      : [];
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  if (urls.length === 0) return null;

  const multiImage = urls.length > 1;
  const gridCls =
    urls.length === 1
      ? "grid grid-cols-1"
      : urls.length === 2
      ? "grid grid-cols-2 gap-1"
      : urls.length === 3
      ? "grid grid-cols-3 gap-1"
      : urls.length === 4
      ? "grid grid-cols-2 gap-1"
      : "grid grid-cols-3 gap-1";
  return (
    <div className="flex flex-col gap-1">
      <div className={cn(gridCls, multiImage && "max-w-[280px]")}>
        {urls.map((url, i) => (
          <div key={url + i} className="group/img relative overflow-hidden rounded-lg">
            <button
              type="button"
              onClick={() => (onOpenImage ? onOpenImage(`${message.id}-${i}`) : setOpenIdx(i))}
              className="w-full"
            >
              <img
                src={url}
                alt={message.imageNames?.[i] ?? `Image ${i + 1}`}
                className={cn(
                  "w-full object-cover",
                  !multiImage ? "max-h-64 object-contain" : "h-24"
                )}
              />
            </button>
            {multiImage && onReply && message.status === "sent" && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onReply(i); }}
                className="absolute bottom-1 right-1 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-body text-white opacity-0 transition-opacity group-hover/img:opacity-100"
              >
                <Reply className="h-3 w-3" /> Reply
              </button>
            )}
          </div>
        ))}
      </div>
      {message.text && (
        <p className="px-1 pt-1 text-sm font-body text-grey-800">{message.text}</p>
      )}
      {!onOpenImage && openIdx !== null && (
        <ImageLightbox urls={urls} index={openIdx} onClose={() => setOpenIdx(null)} onNavigate={setOpenIdx} />
      )}
    </div>
  );
}

export function ImageLightbox({
  urls,
  index,
  onClose,
  onNavigate,
}: {
  urls: string[];
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      if (e.key === "ArrowRight" && index < urls.length - 1) onNavigate(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
    };
    // Capture phase — the customer panel Sheet registers its own capturing
    // keydown listener (see media-lightbox.tsx), which otherwise runs first
    // and swallows these before they reach a bubble-phase listener here.
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [index, urls.length, onClose, onNavigate]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close viewer"
        className="absolute right-4 top-4 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
      >
        <XIcon className="h-5 w-5" />
      </button>
      {index > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNavigate(index - 1); }}
          aria-label="Previous"
          className="absolute left-4 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {index < urls.length - 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNavigate(index + 1); }}
          aria-label="Next"
          className="absolute right-4 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
      <img
        src={urls[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded shadow-xl"
      />
      {urls.length > 1 && (
        <span className="absolute bottom-4 rounded-full bg-black/60 px-2.5 py-1 text-xs font-number text-white">
          {index + 1} / {urls.length}
        </span>
      )}
    </div>
  );
}

function ReplyQuote({ message, isSelf, imageIndex }: { message: CustomerMessage; isSelf: boolean; imageIndex?: number }) {
  const orgUsers = useOrgUsers();
  const sender = orgUsers.find((u) => u.id === message.senderId);

  const urls = message.imageUrls?.length ? message.imageUrls : message.imageUrl ? [message.imageUrl] : [];
  const targetUrl = typeof imageIndex === "number" && urls[imageIndex] ? urls[imageIndex] : null;

  const snippet =
    targetUrl
      ? "Photo"
      : message.text ||
        (message.kind === "image"
          ? "Photo"
          : message.kind === "pdf"
          ? "PDF"
          : message.kind === "voice"
          ? "Voice note"
          : "Message");
  return (
    <div
      className={cn(
        "mb-1 flex items-start gap-2 rounded-md border-l-2 px-2 py-1",
        isSelf ? "border-grey-700 bg-white/40" : "border-primary bg-white/60"
      )}
    >
      <Reply className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-body font-medium text-primary">
          {sender?.name ?? "Someone"}
        </div>
        <div className="truncate text-xs font-body text-grey-600">{snippet}</div>
      </div>
      {targetUrl && (
        <img src={targetUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
      )}
    </div>
  );
}
