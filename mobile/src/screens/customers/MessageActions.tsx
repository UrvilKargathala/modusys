// Long-press a chat message (M6b): the website's quick reactions, then Reply, Copy, Edit (your own text), Forward,
// Message info, Star, Delete for me and Delete for everyone (the sender or a super admin; the server checks too).
// Delete for everyone asks once more first.
import React, { useEffect, useState } from 'react';
// Clipboard still ships with React Native (marked as moving out); no extra package for now.
import { Clipboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { Copy, Forward, Info, Pencil, Reply, Star, StarOff, Trash2 } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { Message } from '../../api/messages';
import { Button, Sheet } from '../../components/ui';
import { colors, radius, space, touch, type } from '../../theme/tokens';

/** As the website's message bubble. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '🎉'];

export type MessageAction =
  | { kind: 'react'; emoji: string }
  | { kind: 'reply' }
  | { kind: 'star' }
  | { kind: 'edit' }
  | { kind: 'forward' }
  | { kind: 'info' }
  | { kind: 'delete'; scope: 'me' | 'everyone' };

function Row({ icon: Icon, label, onPress, danger }: { icon: LucideIcon; label: string; onPress: () => void; danger?: boolean }) {
  const tint = danger ? colors.error : colors.text;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Icon size={20} color={tint} strokeWidth={1.75} />
      <Text style={[type.body, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

export function MessageActions({ message, canDeleteForEveryone, canEdit, onClose, onAction }: {
  message: Message | null;
  canDeleteForEveryone: boolean;
  /** Your own text message (the server only lets the sender edit). */
  canEdit: boolean;
  onClose: () => void;
  onAction: (m: Message, a: MessageAction) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setConfirming(false);
    setCopied(false);
  }, [message?.id]);
  const m = message;
  const act = (a: MessageAction) => {
    if (!m) return;
    onAction(m, a);
    onClose();
  };
  const mine = (emoji: string) => !!m?.reactions.find((r) => r.emoji === emoji)?.reactedByMe;

  return (
    <Sheet visible={!!m} onClose={onClose}>
      {m && confirming ? (
        <View style={styles.confirm}>
          <Text style={type.heading}>Delete for everyone?</Text>
          <Text style={type.body}>The message is removed for the whole team. This can't be undone.</Text>
          <View style={styles.buttons}>
            <View style={styles.flex}><Button label="Cancel" variant="secondary" onPress={() => setConfirming(false)} /></View>
            <View style={styles.flex}><Button label="Delete" variant="danger" onPress={() => act({ kind: 'delete', scope: 'everyone' })} /></View>
          </View>
        </View>
      ) : m ? (
        <View style={styles.body}>
          <View style={styles.emojis} accessibilityLabel="React">
            {QUICK_REACTIONS.map((e) => (
              <Pressable
                key={e}
                accessibilityRole="button"
                accessibilityLabel={mine(e) ? `Remove ${e}` : `React ${e}`}
                accessibilityState={{ selected: mine(e) }}
                onPress={() => act({ kind: 'react', emoji: e })}
                style={[styles.emoji, mine(e) && styles.emojiOn]}
              >
                <Text style={styles.emojiText}>{e}</Text>
              </Pressable>
            ))}
          </View>
          <Row icon={Reply} label="Reply" onPress={() => act({ kind: 'reply' })} />
          {m.text ? (
            <Row
              icon={Copy}
              label={copied ? 'Copied' : 'Copy text'}
              onPress={() => {
                Clipboard.setString(m.text ?? '');
                setCopied(true);
                setTimeout(onClose, 600);
              }}
            />
          ) : null}
          {canEdit ? <Row icon={Pencil} label="Edit" onPress={() => act({ kind: 'edit' })} /> : null}
          <Row icon={Forward} label="Forward" onPress={() => act({ kind: 'forward' })} />
          <Row icon={Info} label="Message info" onPress={() => act({ kind: 'info' })} />
          <Row icon={m.starred ? StarOff : Star} label={m.starred ? 'Unstar' : 'Star'} onPress={() => act({ kind: 'star' })} />
          <Row icon={Trash2} label="Delete for me" danger onPress={() => act({ kind: 'delete', scope: 'me' })} />
          {canDeleteForEveryone ? <Row icon={Trash2} label="Delete for everyone" danger onPress={() => setConfirming(true)} /> : null}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: space.xs, paddingHorizontal: space.screen, paddingBottom: space.lg },
  emojis: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: space.sm },
  emoji: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greyTint },
  emojiOn: { backgroundColor: colors.primaryChip },
  emojiText: { fontSize: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch, paddingHorizontal: space.sm, borderRadius: radius.md },
  pressed: { backgroundColor: colors.greyTint },
  confirm: { gap: space.md, paddingHorizontal: space.screen, paddingBottom: space.lg },
  buttons: { flexDirection: 'row', gap: space.md },
});
