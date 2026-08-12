"use client";

import { Clock, AlertCircle, RotateCcw, Play, Pause, MoreVertical, Copy, Pencil, Trash2, Check, X as XIcon, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MessageText } from "@/components/crm/pipeline/customer-panel/message-text";
import { customerMessagesStore, type CustomerMessage } from "@/lib/store/customer-messages-store";
import { useOrgUsers } from "@/lib/store/users-store";
import { CURRENT_USER_ID } from "@/lib/session";
import { toastStore } from "@/lib/store/toast-store";
import { cn } from "@/lib/utils";

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

function MessageActions({ message, isSelf, onEdit }: { message: CustomerMessage; isSelf: boolean; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
  const canDelete = isSelf;

  if (!canCopy && !canEdit && !canDelete) return null;

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

  const del = () => {
    if (!confirm("Delete this message?")) {
      setOpen(false);
      return;
    }
    customerMessagesStore.deleteMessage(message.customerId, message.id);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
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
          "absolute z-10 mt-1 flex min-w-32 flex-col overflow-hidden rounded-md border border-grey-100 bg-card shadow-md",
          isSelf ? "right-0" : "left-0"
        )}>
          {canCopy && (
            <button type="button" onClick={copy} className="flex items-center gap-2 px-3 py-1.5 text-left text-xs font-body text-grey-700 hover:bg-light-600">
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={() => { onEdit(); setOpen(false); }} className="flex items-center gap-2 px-3 py-1.5 text-left text-xs font-body text-grey-700 hover:bg-light-600">
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={del} className="flex items-center gap-2 px-3 py-1.5 text-left text-xs font-body text-error hover:bg-error-transparent">
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function MessageBubble({ message }: { message: CustomerMessage }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text ?? "");

  if (message.kind === "system") {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-light-600 px-3 py-1 text-xs font-body text-grey-400">
          {message.text} · <span className="font-number">{timeAgo(message.createdAt)}</span>
        </span>
      </div>
    );
  }

  const orgUsers = useOrgUsers();
  const sender = orgUsers.find((u) => u.id === message.senderId);
  const isSelf = message.senderId === CURRENT_USER_ID;

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
      <div className={cn("flex max-w-[75%] flex-col gap-0.5", isSelf ? "items-end" : "items-start")}>
        <div className={cn("flex items-center gap-1", isSelf && "flex-row-reverse")}>
          <span className="text-xs font-body font-medium text-grey-500">{sender?.name ?? "Unknown"}</span>
          <MessageActions
            message={message}
            isSelf={isSelf}
            onEdit={() => {
              setDraft(message.text ?? "");
              setEditing(true);
            }}
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
          {message.kind === "voice" ? (
            <VoiceBubble message={message} />
          ) : message.kind === "image" ? (
            <div className="flex flex-col gap-1">
              <img
                src={message.imageUrl}
                alt={message.imageName ?? ""}
                className="max-h-64 max-w-full rounded-lg object-contain"
              />
              {message.imageName && (
                <span className="px-1 pb-1 text-[11px] font-body text-grey-500">{message.imageName}</span>
              )}
            </div>
          ) : message.kind === "pdf" ? (
            <a
              href={message.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-md bg-white/40 px-2.5 py-1.5 hover:bg-white/60"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-error text-white">
                <FileText className="h-4 w-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-body font-medium">{message.pdfName ?? "Document.pdf"}</span>
                {typeof message.pdfSize === "number" && (
                  <span className="text-[11px] font-body text-grey-500">
                    PDF · {(message.pdfSize / 1024 / 1024).toFixed(2)} MB
                  </span>
                )}
              </span>
            </a>
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
              {timeAgo(message.createdAt)}
              {message.editedAt && <span className="italic text-grey-400">(edited)</span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
