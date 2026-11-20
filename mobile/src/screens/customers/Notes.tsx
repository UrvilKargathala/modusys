// Customer notes (M4, design v2 Prompt 6): the customer's chat from the web,
// oldest first like a chat, grouped by day; your own notes on the right.
// Stage changes show as small centred lines. Photos in a note show as
// thumbnails; voice notes and PDFs are named (play/open them on the web).
// Voice notes play here (ChatComposer.tsx records them; the message box with 📎, @ and 🎤 lives there too).
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { FileText, Forward, Pause, Play } from 'lucide-react-native';
import { voiceLink, type Message } from '../../api/messages';
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

function Bubble({ m, mine, sender, playing, onPlay }: { m: Message; mine: boolean; sender: string; playing: boolean; onPlay: () => void }) {
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
              <Bubble m={m} mine={m.senderId === myId} sender={nameOf(m.senderId)} playing={playing === m.id} onPlay={() => play(m)} />
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
  meta: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.body },
  time: { alignSelf: 'flex-end' },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  image: { width: 140, height: 140, borderRadius: radius.md, backgroundColor: colors.greyTint },
  play: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
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
