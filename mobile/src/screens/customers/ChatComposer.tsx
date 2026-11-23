// The customer chat's message box, as on the website: 📎 attach (camera, gallery photos, PDF; staged in a preview row
// until Send), @ to mention a team member (the server gives them a follow-up task and a notification), and 🎤 to
// record a voice note. Photos go as one message with the typed text as the caption; each PDF as its own message.
import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../components/Text';
import { Camera, FileText, Images, Mic, Paperclip, SendHorizontal, Trash2, X } from 'lucide-react-native';
import type { OrgUser } from '../../api/customers';
import { sendImages, sendNote, sendPdf, sendVoice } from '../../api/messages';
import type { LocalFile } from '../../api/upload';
import { Notice, Sheet } from '../../components/ui';
import { MAX_CHAT_FILE_BYTES, pickPdf, pickSitePhotos, takeSitePhoto, type PickedPdf } from '../../lib/device';
import { mentionQuery } from '../../lib/mentions';
import { startVoice, stopVoice } from '../../lib/voice';
import { colors, radius, shadow, space, touch, type } from '../../theme/tokens';

type Source = 'camera' | 'gallery' | 'pdf';
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function ChatComposer({ customerId, myId, users, onSent, replyTo, onCancelReply }: {
  customerId: string;
  myId: string;
  /** Team members who can be mentioned. */
  users: OrgUser[];
  onSent: () => void;
  /** Replying to this message (long-press > Reply): shown above the box, sent with the text or photos. */
  replyTo?: { id: string; who: string; snippet: string } | null;
  onCancelReply?: () => void;
}) {
  const [text, setText] = useState('');
  const [cursor, setCursor] = useState(0);
  const [mentioned, setMentioned] = useState<{ id: string; name: string }[]>([]);
  const [photos, setPhotos] = useState<LocalFile[]>([]);
  const [pdfs, setPdfs] = useState<PickedPdf[]>([]);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const pending = useRef<Source | null>(null);

  // Never leave the microphone on when the screen closes mid-recording.
  useEffect(() => () => {
    stopVoice().catch(() => undefined);
  }, []);

  const query = mentionQuery(text, cursor);
  const matches = query === null ? [] : users.filter((u) => u.id !== myId && u.status !== 'inactive' && u.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
  const pickMention = (u: OrgUser) => {
    const at = text.slice(0, cursor).lastIndexOf('@');
    const next = `${text.slice(0, at)}@${u.name} ${text.slice(cursor)}`;
    setText(next);
    setCursor(at + u.name.length + 2);
    setMentioned((m) => (m.some((x) => x.id === u.id) ? m : [...m, { id: u.id, name: u.name }]));
  };

  // iOS can't open a picker while the sheet is still sliding away, so it opens from onDismiss there.
  const choose = (from: Source) => {
    setMenu(false);
    if (Platform.OS === 'ios') pending.current = from;
    else attach(from).catch(() => undefined);
  };
  const onMenuGone = () => {
    const from = pending.current;
    pending.current = null;
    if (from) attach(from).catch(() => undefined);
  };
  const attach = async (from: Source) => {
    setError(null);
    if (from === 'pdf') {
      const r = await pickPdf();
      if (r.ok) setPdfs((p) => [...p, r.pdf]);
      else if (r.reason === 'too-big') setError('That PDF is over 20 MB.');
      else if (r.reason === 'failed') setError("Couldn't open that file.");
      return;
    }
    const r = from === 'camera' ? await takeSitePhoto() : await pickSitePhotos();
    if (!r.ok) {
      if (r.reason === 'denied') setError('Allow camera or photo access in Settings to attach photos.');
      else if (r.reason === 'no-camera') setError('This phone has no camera available.');
      else if (r.reason === 'failed' || r.reason === 'too-big') setError("Couldn't attach that photo.");
      return;
    }
    const big = r.photos.find((p) => (p.fileSize ?? 0) > MAX_CHAT_FILE_BYTES);
    if (big) return setError('A photo is over 20 MB.');
    setPhotos((p) => [...p, ...r.photos.map((a) => ({ uri: a.uri, type: a.type || 'image/jpeg', name: a.fileName || `photo-${Date.now()}.jpg` }))]);
  };

  const hasFiles = photos.length > 0 || pdfs.length > 0;
  const canSend = (text.trim().length > 0 || hasFiles) && !busy;

  const send = async () => {
    setBusy(true);
    setError(null);
    const body = text.trim();
    // Only people still named in the text count as mentioned.
    const ids = mentioned.filter((m) => body.includes(`@${m.name}`)).map((m) => m.id);
    try {
      const reply = replyTo?.id;
      if (photos.length) await sendImages(customerId, photos, body, reply);
      for (const p of pdfs) await sendPdf(customerId, p);
      // Without photos the text goes as its own message (a PDF has no caption).
      if (!photos.length && body) await sendNote(customerId, body, ids, reply);
      onCancelReply?.();
      setText('');
      setMentioned([]);
      setPhotos([]);
      setPdfs([]);
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const startRec = async () => {
    setError(null);
    setSeconds(0);
    if (await startVoice(setSeconds)) setRecording(true);
    else setError('Allow the microphone in Settings to record a voice note.');
  };
  const finishRec = async (keep: boolean) => {
    setRecording(false);
    let uri: string;
    try {
      uri = await stopVoice();
    } catch {
      return setError("Couldn't save the voice note.");
    }
    if (!keep) return;
    if (seconds < 1) return setError('Hold on a little longer: that voice note was under a second.');
    setBusy(true);
    try {
      await sendVoice(customerId, uri, seconds);
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the voice note.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {error ? <Notice text={error} /> : null}
      {replyTo ? (
        <View style={styles.replyBar} accessibilityLabel={`Replying to ${replyTo.who}: ${replyTo.snippet}`}>
          <View style={styles.replyText}>
            <Text style={styles.replyWho} numberOfLines={1}>Replying to {replyTo.who}</Text>
            <Text style={type.small} numberOfLines={1}>{replyTo.snippet}</Text>
          </View>
          <RemoveButton inline label="Cancel reply" onPress={() => onCancelReply?.()} />
        </View>
      ) : null}

      {matches.length ? (
        <View style={styles.mentions} accessibilityRole="menu">
          {matches.map((u) => (
            <Pressable key={u.id} accessibilityRole="menuitem" onPress={() => pickMention(u)} style={({ pressed }) => [styles.mention, pressed && styles.pressed]}>
              <Text style={type.body}>@{u.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {hasFiles ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.staged}>
          {photos.map((p, i) => (
            <View key={p.uri} style={styles.thumbWrap}>
              <Image source={{ uri: p.uri }} style={styles.thumb} accessibilityLabel={`Photo ${i + 1} to send`} />
              <RemoveButton onPress={() => setPhotos((x) => x.filter((_, j) => j !== i))} label="Remove photo" />
            </View>
          ))}
          {pdfs.map((p, i) => (
            <View key={p.uri} style={styles.pdfChip}>
              <FileText size={16} color={colors.primary} strokeWidth={1.75} />
              <Text style={[type.small, styles.pdfName]} numberOfLines={1}>{p.name}</Text>
              <RemoveButton onPress={() => setPdfs((x) => x.filter((_, j) => j !== i))} label="Remove PDF" inline />
            </View>
          ))}
        </ScrollView>
      ) : null}

      {recording ? (
        <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel="Discard voice note" onPress={() => finishRec(false)} style={styles.icon}>
            <Trash2 size={20} color={colors.error} strokeWidth={1.75} />
          </Pressable>
          <View style={styles.recBar} accessibilityLiveRegion="polite">
            <View style={styles.recDot} />
            <Text style={type.body}>Recording {mmss(seconds)}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Send voice note" onPress={() => finishRec(true)} style={styles.send}>
            <SendHorizontal size={20} color={colors.white} strokeWidth={1.75} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel="Attach a photo or PDF" onPress={() => setMenu(true)} disabled={busy} style={styles.icon}>
            <Paperclip size={20} color={colors.textSecondary} strokeWidth={1.75} />
          </Pressable>
          <TextInput
            accessibilityLabel="Write a message"
            placeholder={hasFiles && photos.length ? 'Add a caption…' : 'Message… use @ to mention'}
            placeholderTextColor={colors.placeholder}
            value={text}
            onChangeText={(t) => {
              setText(t);
              setCursor(t.length);
            }}
            onSelectionChange={(e) => setCursor(e.nativeEvent.selection.end)}
            multiline
            maxLength={4000}
            style={styles.input}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Record a voice note" onPress={startRec} disabled={busy} style={styles.icon}>
            <Mic size={20} color={colors.textSecondary} strokeWidth={1.75} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !canSend, busy }}
            disabled={!canSend}
            onPress={send}
            style={[styles.send, !canSend && styles.sendOff]}
          >
            <SendHorizontal size={20} color={colors.white} strokeWidth={1.75} />
          </Pressable>
        </View>
      )}

      <Sheet visible={menu} onClose={() => setMenu(false)} onDismiss={onMenuGone}>
        <View style={styles.menu}>
          <Text style={type.heading} accessibilityRole="header">Attach</Text>
          <MenuRow icon={Camera} label="Take a photo" onPress={() => choose('camera')} />
          <MenuRow icon={Images} label="Photos from gallery" onPress={() => choose('gallery')} />
          <MenuRow icon={FileText} label="PDF document" onPress={() => choose('pdf')} />
        </View>
      </Sheet>
    </View>
  );
}

function RemoveButton({ onPress, label, inline }: { onPress: () => void; label: string; inline?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={inline ? undefined : styles.remove}>
      <X size={14} color={inline ? colors.textSecondary : colors.white} strokeWidth={2.5} />
    </Pressable>
  );
}

function MenuRow({ icon: Icon, label, onPress }: { icon: typeof Camera; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
      <View style={styles.menuIcon}><Icon size={20} color={colors.primary} strokeWidth={1.75} /></View>
      <Text style={type.body}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
    paddingHorizontal: space.screen,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    backgroundColor: colors.primaryTint,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  replyText: { flex: 1, gap: 1 },
  replyWho: { ...type.small, fontWeight: '600', color: colors.primary },
  icon: { width: touch - 4, height: touch, alignItems: 'center', justifyContent: 'center' },
  input: {
    ...type.body,
    flex: 1,
    minHeight: touch,
    maxHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: space.md,
    paddingTop: space.sm + 4,
    paddingBottom: space.sm + 4,
  },
  send: { width: touch, height: touch, borderRadius: touch / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
  mentions: { backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: space.xs, ...shadow },
  mention: { minHeight: touch, justifyContent: 'center', paddingHorizontal: space.md },
  staged: { gap: space.sm, paddingVertical: space.xs },
  thumbWrap: { width: 64, height: 64 },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.greyTint },
  remove: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' },
  pdfChip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, maxWidth: 200, height: 64, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: colors.primaryTint },
  pdfName: { flexShrink: 1, color: colors.text },
  recBar: { flex: 1, minHeight: touch, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, borderRadius: radius.lg, backgroundColor: colors.errorTint },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
  menu: { paddingHorizontal: space.screen, paddingBottom: space.lg, gap: space.xs },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch + 8 },
  menuIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
});
