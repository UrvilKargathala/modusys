// Customer notes (M4, design v2 Prompt 6): the customer's chat from the web,
// oldest first like a chat, grouped by day; your own notes on the right.
// Stage changes show as small centred lines. Photos in a note show as
// thumbnails; voice notes and PDFs are named (play/open them on the web).
// The composer sends plain text notes (no @mentions on the phone yet).
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FileText, Forward, Mic, SendHorizontal } from 'lucide-react-native';
import type { Message } from '../../api/messages';
import { imageSource } from '../../api/client';
import { formatDay, formatTime, istToday } from '../../lib/format';
import { colors, fonts, radius, shadow, space, touch, type } from '../../theme/tokens';

/** IST calendar day of a timestamp, as YYYY-MM-DD. */
const istDay = (iso: string) => istToday(new Date(iso));

function dayLabel(day: string): string {
  const today = istToday();
  const yesterday = istToday(new Date(Date.now() - 24 * 60 * 60 * 1000));
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  return formatDay(day);
}

function Bubble({ m, mine, sender }: { m: Message; mine: boolean; sender: string }) {
  const tint = mine ? colors.white : colors.text;
  const sub = mine ? colors.onPrimaryMuted : colors.textSecondary;
  return (
    <View style={[styles.bubbleRow, mine ? styles.right : styles.left]}>
      {!mine ? <Text style={styles.sender}>{sender}</Text> : null}
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        {m.isForwarded ? (
          <View style={styles.inline}>
            <Forward size={12} color={sub} />
            <Text style={[styles.meta, { color: sub }]}>Forwarded</Text>
          </View>
        ) : null}
        {m.imageUrls.length ? (
          <View style={styles.images}>
            {m.imageUrls.map((u) => (
              <Image key={u} source={imageSource(u)} style={styles.image} accessibilityLabel="Photo in note" />
            ))}
          </View>
        ) : null}
        {m.kind === 'voice' ? (
          <View style={styles.inline}>
            <Mic size={16} color={tint} strokeWidth={1.5} />
            <Text style={[type.body, { color: tint }]}>
              Voice note{m.durationSec ? ` · ${Math.floor(m.durationSec / 60)}:${String(Math.round(m.durationSec % 60)).padStart(2, '0')}` : ''}
            </Text>
          </View>
        ) : null}
        {m.kind === 'pdf' ? (
          <View style={styles.inline}>
            <FileText size={16} color={tint} strokeWidth={1.5} />
            <Text style={[type.body, styles.flexShrink, { color: tint }]} numberOfLines={1}>{m.pdfName ?? 'PDF'}</Text>
          </View>
        ) : null}
        {m.text ? <Text style={[type.body, { color: tint }]}>{m.text}</Text> : null}
        <Text style={[styles.meta, styles.time, { color: sub }]}>
          {formatTime(m.createdAt)}
          {m.editedAt ? ' · edited' : ''}
        </Text>
      </View>
      {m.reactions.length ? (
        <View style={styles.reactions}>
          {m.reactions.map((r) => (
            <View key={r.emoji} style={[styles.reaction, r.reactedByMe && styles.reactionMine]}>
              <Text style={styles.reactionText}>
                {r.emoji} {r.count}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function NotesList({ messages, myId, nameOf }: {
  messages: Message[];
  myId: string;
  nameOf: (userId: string | null) => string;
}) {
  let lastDay = '';
  return (
    <View style={styles.list}>
      {messages.map((m) => {
        const day = istDay(m.createdAt);
        const header = day !== lastDay ? <Text style={styles.day}>{dayLabel(day)}</Text> : null;
        lastDay = day;
        return (
          <React.Fragment key={m.id}>
            {header}
            {m.kind === 'system' ? (
              <View style={styles.system}>
                <Text style={styles.systemText}>{m.text}</Text>
                <Text style={styles.meta}>{formatTime(m.createdAt)}</Text>
              </View>
            ) : (
              <Bubble m={m} mine={m.senderId === myId} sender={nameOf(m.senderId)} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

/** "Add a note…" box with a round send button, pinned under the timeline. */
export function NoteComposer({ onSend, sending }: { onSend: (text: string) => Promise<boolean>; sending: boolean }) {
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0 && !sending;
  return (
    <View style={styles.composer}>
      <TextInput
        accessibilityLabel="Write a message"
        placeholder="Write a message…"
        placeholderTextColor={colors.placeholder}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={4000}
        style={styles.input}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send note"
        accessibilityState={{ disabled: !canSend, busy: sending }}
        disabled={!canSend}
        onPress={async () => {
          if (await onSend(text.trim())) setText('');
        }}
        style={[styles.send, !canSend && styles.sendOff]}
      >
        <SendHorizontal size={20} color={colors.white} strokeWidth={1.75} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  day: { ...type.small, alignSelf: 'center', marginTop: space.sm, fontWeight: '600' },
  bubbleRow: { maxWidth: '84%', gap: 4 },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  sender: { ...type.small, marginLeft: space.sm },
  bubble: { borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm + 2, gap: space.xs },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm / 2 },
  theirs: { backgroundColor: colors.card, borderBottomLeftRadius: radius.sm / 2, ...shadow },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  flexShrink: { flexShrink: 1 },
  meta: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.body },
  time: { alignSelf: 'flex-end' },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  image: { width: 140, height: 140, borderRadius: radius.md, backgroundColor: colors.greyTint },
  reactions: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  reaction: {
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionMine: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  reactionText: { fontSize: 12 },
  system: { alignSelf: 'center', alignItems: 'center', gap: 2, backgroundColor: colors.greyTint, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.xs + 2, maxWidth: '90%' },
  systemText: { ...type.small, color: colors.grey, textAlign: 'center' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.screen,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
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
});
