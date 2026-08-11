"use client";

import { useRef, useState } from "react";
import { Paperclip, Mic, Square, Send, AlertCircle } from "lucide-react";
import { MentionDropdown } from "@/components/crm/pipeline/customer-panel/mention-dropdown";
import { customerMessagesStore } from "@/lib/store/customer-messages-store";
import { customerMediaStore } from "@/lib/store/customer-media-store";
import { mockUsers, type OrgUser } from "@/lib/mock/users";
import { CURRENT_USER_ID } from "@/lib/session";
import { cn } from "@/lib/utils";

export function MessageInput({ customerId }: { customerId: string }) {
  const [text, setText] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mentionUsers: OrgUser[] =
    mentionQuery === null
      ? []
      : mockUsers.filter((u) => u.name.toLowerCase().includes(mentionQuery.toLowerCase()));

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
    if (!text.trim()) return;
    customerMessagesStore.sendMessage(customerId, text.trim(), CURRENT_USER_ID, mentionedIds);
    setText("");
    setMentionedIds([]);
  };

  // Canvas-downscale an image to max 1200px on the long edge, JPEG q=0.75.
  // Keeps localStorage happy regardless of raw camera size (5-15MB → ~100KB).
  const downscaleImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 1200;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("canvas 2d unavailable"));
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.75));
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("image decode failed"));
      };
      img.src = url;
    });
  };

  const handleAttach = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      customerMediaStore.addFile(customerId, file);
      if (file.type.startsWith("image/")) {
        // Inline preview bubble. Downscale first so persistence stays sane.
        try {
          const dataUrl = await downscaleImage(file);
          customerMessagesStore.addImageMessage(customerId, CURRENT_USER_ID, dataUrl, file.name);
        } catch {
          customerMessagesStore.sendMessage(customerId, `📎 Shared a file: ${file.name}`, CURRENT_USER_ID, []);
        }
      } else if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        // PDF card — icon + name + size. Bytes stay in the gallery only
        // (persisting the full PDF would blow localStorage).
        customerMessagesStore.addPdfMessage(customerId, CURRENT_USER_ID, file.name, file.size);
      } else {
        customerMessagesStore.sendMessage(customerId, `📎 Shared a file: ${file.name}`, CURRENT_USER_ID, []);
      }
    }
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
        const url = URL.createObjectURL(blob);
        customerMessagesStore.addVoiceMessage(customerId, CURRENT_USER_ID, url, recordSeconds);
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
            className="hidden"
            onChange={(e) => handleAttach(e.target.files)}
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
            placeholder="Message... use @ to mention"
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
            disabled={!text.trim()}
            aria-label="Send message"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
              text.trim() ? "bg-teal text-grey-900 hover:bg-teal/80" : "bg-grey-100 text-grey-300"
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
