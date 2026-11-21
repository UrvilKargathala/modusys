// Customer notes (M4, design v2 Prompt 6): the customer's chat from the web,
// oldest first like a chat, grouped by day; your own notes on the right.
// Stage changes show as small centred lines. Photos in a note show as
// thumbnails; voice notes play here and PDFs open in the phone's own viewer (a 2-minute link).
// Voice notes play here (ChatComposer.tsx records them; the message box with 📎, @ and 🎤 lives there too).
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { FileText, Forward, ListTodo, Pause, Play, Star } from 'lucide-react-native';
import { voiceLink, type Message } from '../../api/messages';
import { openFile } from '../../lib/files';
import { imageSource } from '../../api/client';
import { formatDay, formatTime, istToday } from '../../lib/format';
import { stopPlaying, togglePlay } from '../../lib/voice';
import { colors, fonts, radius, shadow, space, type } from '../../theme/tokens';

/** IST calendar day of a timestamp, as YYYY-MM-DD. */
const istDay = (iso: string) => istToday(new Date(iso));

function dayLabel(day: string): string {
  const today = istToday();
  const yesterday = istToday(new Date(Date.now() - 24 * 60 * 60 * 1000));
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  return formatDay(day);
}

/** What a reply quotes: the first line of the text, or what kind of message it was. */
export function snippet(m: Message): string {
  if (m.text) return m.text.split('\n')[0];
  if (m.kind === 'voice') return 'Voice note';
  if (m.kind === 'pdf') return m.pdfName ?? 'PDF';
  if (m.imageUrls.length) return m.imageUrls.length > 1 ? `${m.imageUrls.length} photos` : 'Photo';
  return 'Message';
}

function Bubble({ m, mine, sender, playing, onPlay, onLongPress, quoted, quotedSender, nameOf }: {
  nameOf: (userId: string | null) => string;
  m: Message;
  mine: boolean;
  sender: string;
  playing: boolean;
  onPlay: () => void;
  onLongPress: () => void;
  /** The message this one replies to, when it's still in the chat. */
  quoted?: Message;
  quotedSender?: string;
}) {
  const tint = mine ? colors.white : colors.text;
  const sub = mine ? colors.onPrimaryMuted : colors.textSecondary;
  return (
    <View style={[styles.bubbleRow, mine ? styles.right : styles.left]}>
      {!mine ? <Text style={styles.sender}>{sender}</Text> : null}
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={350}
        accessibilityHint="Long-press for reply, react, copy, star and delete"
        style={[styles.bubble, mine ? styles.mine : styles.theirs]}
      >
        {m.replyToMessageId ? (
          <View style={[styles.quote, mine ? styles.quoteMine : styles.quoteTheirs]}>
            <Text style={[styles.quoteName, { color: mine ? colors.white : colors.primary }]} numberOfLines={1}>
              {quoted ? quotedSender : 'Reply'}
            </Text>
            <Text style={[styles.meta, { color: sub }]} numberOfLines={2}>
              {quoted ? snippet(quoted) : 'Original message was deleted'}
            </Text>
          </View>
        ) : null}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Stop voice note' : 'Play voice note'}
            disabled={!m.audioUrl}
            onPress={onPlay}
            style={styles.inline}
          >
            <View style={[styles.play, { borderColor: tint }]}>
              {playing ? <Pause size={14} color={tint} strokeWidth={2} /> : <Play size={14} color={tint} strokeWidth={2} />}
            </View>
            <Text style={[type.body, { color: tint }]}>
              Voice note{m.durationSec ? ` · ${Math.floor(m.durationSec / 60)}:${String(Math.round(m.durationSec % 60)).padStart(2, '0')}` : ''}
            </Text>
          </Pressable>
        ) : null}
        {m.kind === 'pdf' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${m.pdfName ?? 'PDF'}`}
            onPress={() => openFile({ message: m.id })}
            onLongPress={onLongPress}
            style={styles.inline}
          >
            <FileText size={16} color={tint} strokeWidth={1.5} />
            <Text style={[type.body, styles.flexShrink, styles.link, { color: tint }]} numberOfLines={1}>{m.pdfName ?? 'PDF'}</Text>
          </Pressable>
        ) : null}
        {m.text ? <Text style={[type.body, { color: tint }]}>{m.text}</Text> : null}
        {(m.mentionedUserIds ?? []).filter((u) => u !== m.senderId).length ? (
          <View style={styles.chips}>
            {(m.mentionedUserIds ?? []).filter((u) => u !== m.senderId).map((u) => (
              <View key={u} style={[styles.chip, mine && styles.chipMine]} accessibilityLabel={`A task was given to ${nameOf(u)}`}>
                <ListTodo size={11} color={mine ? colors.white : colors.primary} />
                <Text style={[styles.chipText, { color: mine ? colors.white : colors.primary }]}>Task → {nameOf(u)}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={[styles.inline, styles.time]}>
          {m.starred ? <Star size={11} color={sub} fill={sub} accessibilityLabel="Starred" /> : null}
          <Text style={[styles.meta, { color: sub }]}>
            {formatTime(m.createdAt)}
            {m.editedAt ? ' · edited' : ''}
          </Text>
        </View>
      </Pressable>
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

export function NotesList({ messages, myId, nameOf, onLongPress }: {
  messages: Message[];
  myId: string;
  nameOf: (userId: string | null) => string;
  onLongPress: (m: Message) => void;
}) {
  const byId = new Map(messages.map((x) => [x.id, x]));
  const [playing, setPlaying] = useState<string | null>(null);
  // Stop any voice note when the chat closes.
  useEffect(() => () => {
    stopPlaying().catch(() => undefined);
  }, []);
  const play = (m: Message) => {
    togglePlay(m.id, () => voiceLink(m.id), setPlaying).catch(() => undefined);
  };
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
              <Bubble
                m={m}
                mine={m.senderId === myId}
                sender={nameOf(m.senderId)}
                playing={playing === m.id}
                onPlay={() => play(m)}
                onLongPress={() => onLongPress(m)}
                nameOf={nameOf}
                quoted={m.replyToMessageId ? byId.get(m.replyToMessageId) : undefined}
                quotedSender={(() => {
                  const q = m.replyToMessageId ? byId.get(m.replyToMessageId) : undefined;
                  return q ? (q.senderId === myId ? 'You' : nameOf(q.senderId)) : undefined;
                })()}
              />
            )}
          </React.Fragment>
        );
      })}
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
  link: { textDecorationLine: 'underline' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, backgroundColor: colors.primaryTint },
  chipMine: { backgroundColor: colors.onBlackButton },
  chipText: { fontSize: 11, fontWeight: '600', fontFamily: fonts.body },
  meta: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.body },
  time: { alignSelf: 'flex-end' },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  image: { width: 140, height: 140, borderRadius: radius.md, backgroundColor: colors.greyTint },
  play: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  quote: { borderLeftWidth: 3, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 4, gap: 1 },
  quoteMine: { borderLeftColor: colors.white, backgroundColor: colors.onBlackButton },
  quoteTheirs: { borderLeftColor: colors.primary, backgroundColor: colors.primaryTint },
  quoteName: { fontSize: 12, fontWeight: '600', fontFamily: fonts.body },
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
});
