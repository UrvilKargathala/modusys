"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Paperclip, Mic, Square, Send, AlertCircle, X, Reply } from "lucide-react";
import { MentionDropdown } from "@/components/crm/pipeline/customer-panel/mention-dropdown";
import { customerMessagesStore, type CustomerMessage } from "@/lib/store/customer-messages-store";
import { customerMediaStore } from "@/lib/store/customer-media-store";
import { useOrgUsers } from "@/lib/store/users-store";
import type { OrgUser } from "@/lib/mock/users";
import { CURRENT_USER_ID } from "@/lib/session";
import { cn } from "@/lib/utils";

export type MessageInputHandle = {
  attachFiles: (files: FileList) => void;
};

export const MessageInput = forwardRef<MessageInputHandle, {
  customerId: string;
  replyTarget?: CustomerMessage | null;
  replyImageIndex?: number;
  onClearReply?: () => void;
}>(function MessageInput({
  customerId,
  replyTarget,
  replyImageIndex,
  onClearReply,
}, ref) {
  const [text, setText] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  // Picked images held in state until the user hits Send (WhatsApp-style
  // batch preview + optional caption). PDFs/other files still send
  // immediately as separate messages.
  const [pendingImages, setPendingImages] = useState<{ file: File; url: string }[]>([]);
  // NOTE: previously had a `useEffect(..., [pendingImages])` cleanup that
  // revoked blob URLs — but the cleanup fires BEFORE the next effect runs
  // on every state change, so adding a 2nd image revoked the 1st's URL
  // mid-render, breaking its preview. removePending() and Send are the only
  // two places where a URL genuinely leaves state, so revoke happens there.

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const orgUsers = useOrgUsers();
  const replySender = replyTarget ? orgUsers.find((u) => u.id === replyTarget.senderId)?.name : null;
  const mentionUsers: OrgUser[] =
    mentionQuery === null
      ? []
      : orgUsers.filter((u) => u.name.toLowerCase().includes(mentionQuery.toLowerCase()));

  const handleTextChange = (value: string) => {
    setText(value);
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const upToCursor = value.slice(0, cursor);
    const atIndex = upToCursor.lastIndexOf("@");
    if (atIndex === -1 || /\s/.test(upToCursor.slice(atIndex + 1))) {
      setMentionQuery(null);
    } else {
      setMentionQuery(upToCursor.slice(atIndex + 1));
    }
  };

  const insertMention = (user: OrgUser) => {
    const cursor = textareaRef.current?.selectionStart ?? text.length;
    const upToCursor = text.slice(0, cursor);
    const atIndex = upToCursor.lastIndexOf("@");
    const next = `${text.slice(0, atIndex)}@${user.name} ${text.slice(cursor)}`;
    setText(next);
    setMentionedIds((prev) => [...new Set([...prev, user.id])]);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const send = () => {
    // Priority: if user has pending images, send them as a group (with the
    // typed text as caption). Otherwise send a plain text message.
    if (pendingImages.length > 0) {
      customerMessagesStore.addImageGroupMessage(
        customerId,
        CURRENT_USER_ID,
        pendingImages.map((p) => p.file),
        text.trim() || undefined
      );
      // The store creates its OWN blob URLs for the optimistic preview, so
      // it's safe to revoke ours here without breaking the just-inserted
      // optimistic message.
      pendingImages.forEach((p) => URL.revokeObjectURL(p.url));
      setPendingImages([]);
      setText("");
      setMentionedIds([]);
      onClearReply?.();
      return;
    }
    if (!text.trim()) return;
    customerMessagesStore.sendMessage(
      customerId,
      text.trim(),
      CURRENT_USER_ID,
      mentionedIds,
      replyTarget?.id,
      replyImageIndex
    );
    setText("");
    setMentionedIds([]);
    onClearReply?.();
  };

  const handleAttach = async (files: FileList | null) => {
    if (!files) return;
    if (files.length === 0) return;
    // Split: batch images to send as a gallery, PDFs/other still send one
    // message per file (existing behaviour).
    const images: File[] = [];
    for (const file of Array.from(files)) {
      customerMediaStore.addFile(customerId, file);
      if (file.type.startsWith("image/")) {
        images.push(file);
      } else if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        customerMessagesStore.addPdfMessage(customerId, CURRENT_USER_ID, file);
      } else {
        customerMessagesStore.sendMessage(customerId, `Shared a file: ${file.name}`, CURRENT_USER_ID, []);
      }
    }
    if (images.length > 0) {
      setPendingImages((prev) => [
        ...prev,
        ...images.map((file) => ({ file, url: URL.createObjectURL(file) })),
      ]);
      textareaRef.current?.focus();
    }
  };

  useImperativeHandle(ref, () => ({
    attachFiles: (files: FileList) => { handleAttach(files); },
  }));

  const removePending = (index: number) => {
    setPendingImages((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });
  };

  const startRecording = async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        customerMessagesStore.addVoiceMessage(customerId, CURRENT_USER_ID, blob, recordSeconds);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setMicError("Microphone access denied — allow it in your browser settings to record a voice note.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return (
    <div className="flex flex-col gap-2 border-t border-grey-100 p-3">
      {micError && (
        <span className="flex items-center gap-1.5 text-xs font-body text-error">
          <AlertCircle className="h-3.5 w-3.5" />
          {micError}
        </span>
      )}

      {replyTarget && (() => {
        const replyUrls = replyTarget.imageUrls?.length ? replyTarget.imageUrls : replyTarget.imageUrl ? [replyTarget.imageUrl] : [];
        const replyThumb = typeof replyImageIndex === "number" && replyUrls[replyImageIndex] ? replyUrls[replyImageIndex] : null;
        return (
          <div className="flex items-start gap-2 rounded-md border-l-2 border-primary bg-light-600/60 px-2 py-1.5">
            <Reply className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-body font-medium text-primary">
                Replying to {replySender ?? "message"}
              </div>
              <div className="truncate text-xs font-body text-grey-600">
                {replyThumb
                  ? "Photo"
                  : replyTarget.text ||
                    (replyTarget.kind === "image"
                      ? "Photo"
                      : replyTarget.kind === "pdf"
                      ? "PDF"
                      : replyTarget.kind === "voice"
                      ? "Voice note"
                      : "Message")}
              </div>
            </div>
            {replyThumb && (
              <img src={replyThumb} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
            )}
            <button
              type="button"
              onClick={() => onClearReply?.()}
              aria-label="Cancel reply"
              className="rounded p-1 text-grey-400 hover:bg-light-600 hover:text-grey-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })()}

      {pendingImages.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-md bg-light-600/60 p-2">
          {pendingImages.map((p, i) => (
            <div key={p.url} className="group relative">
              <img
                src={p.url}
                alt={p.file.name}
                className="h-16 w-16 rounded-md object-cover"
              />
              <button
                type="button"
                onClick={() => removePending(i)}
                aria-label={`Remove ${p.file.name}`}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-grey-900 text-white opacity-0 shadow group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <span className="ml-1 self-center text-[11px] font-body text-grey-500">
            Add a caption below (optional)
          </span>
        </div>
      )}

      {recording ? (
        <div className="flex items-center gap-3 rounded-lg bg-error-transparent px-3 py-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-error" />
          <span className="flex-1 text-sm font-number text-error">
            Recording… 0:{String(recordSeconds).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={stopRecording}
            aria-label="Stop recording"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-error text-white"
          >
            <Square className="h-3.5 w-3.5 fill-white" />
          </button>
        </div>
      ) : (
        <div className="relative flex items-end gap-2">
          {mentionUsers.length > 0 && (
            <MentionDropdown users={mentionUsers} onSelect={insertMention} />
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-grey-400 hover:bg-light-600 hover:text-primary"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              handleAttach(e.target.files);
              e.target.value = ""; // allow re-selecting the same file again
            }}
          />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={pendingImages.length > 0 ? "Add a caption (optional)…" : "Message... use @ to mention"}
            rows={1}
            className="max-h-32 min-h-9 flex-1 resize-none overflow-hidden rounded-2xl border border-grey-100 bg-light-600/60 px-3 py-2 text-sm font-body text-grey-900 outline-none placeholder:truncate placeholder:text-grey-300 focus:border-primary"
          />

          <button
            type="button"
            onClick={startRecording}
            aria-label="Record voice note"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-grey-400 hover:bg-light-600 hover:text-primary"
          >
            <Mic className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={send}
            disabled={!text.trim() && pendingImages.length === 0}
            aria-label="Send message"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
              text.trim() || pendingImages.length > 0
                ? "bg-teal text-grey-900 hover:bg-teal/80"
                : "bg-grey-100 text-grey-300"
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
});
