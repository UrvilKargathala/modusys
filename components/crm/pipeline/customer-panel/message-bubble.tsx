"use client";

import { Clock, AlertCircle, RotateCcw, Play, Pause } from "lucide-react";
import { useRef, useState } from "react";
import { MessageText } from "@/components/crm/pipeline/customer-panel/message-text";
import { customerMessagesStore, type CustomerMessage } from "@/lib/store/customer-messages-store";
import { mockUsers } from "@/lib/mock/users";
import { CURRENT_USER_ID } from "@/lib/session";
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
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal text-white"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
      </button>
      <div className="flex h-6 flex-1 items-center gap-0.5">
        {bars.map((h, i) => (
          <span key={i} className="w-0.5 rounded-full bg-primary-300" style={{ height: `${h}%` }} />
        ))}
      </div>
      <span className="text-xs font-body text-grey-400">
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

export function MessageBubble({ message }: { message: CustomerMessage }) {
  if (message.kind === "system") {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-light-600 px-3 py-1 text-xs font-body text-grey-400">
          {message.text} · {timeAgo(message.createdAt)}
        </span>
      </div>
    );
  }

  const sender = mockUsers.find((u) => u.id === message.senderId);
  const isSelf = message.senderId === CURRENT_USER_ID;

  return (
    <div className={cn("flex gap-2", isSelf ? "flex-row-reverse" : "flex-row")}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-transparent text-xs font-medium text-primary">
        {sender?.name?.[0] ?? "?"}
      </span>
      <div className={cn("flex max-w-[75%] flex-col gap-0.5", isSelf ? "items-end" : "items-start")}>
        <span className="text-xs font-body font-medium text-grey-500">{sender?.name ?? "Unknown"}</span>
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm font-body",
            isSelf ? "bg-teal text-white" : "bg-light-600 text-grey-800",
            message.status === "error" && "border border-error"
          )}
        >
          {message.kind === "voice" ? (
            <VoiceBubble message={message} />
          ) : (
            <MessageText text={message.text ?? ""} inverted={isSelf} />
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-body text-grey-300">
          {message.status === "pending" && (
            <>
              <Clock className="h-3 w-3" /> Sending…
            </>
          )}
          {message.status === "error" && (
            <button
              type="button"
              onClick={() => customerMessagesStore.retryMessage(message.id)}
              className="flex items-center gap-1 text-error hover:underline"
            >
              <AlertCircle className="h-3 w-3" /> Failed — tap to retry <RotateCcw className="h-3 w-3" />
            </button>
          )}
          {message.status === "sent" && timeAgo(message.createdAt)}
        </div>
      </div>
    </div>
  );
}
