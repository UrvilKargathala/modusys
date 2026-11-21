// The chat's follow-up sheets (M6b, chat pass 2), opened from a message's long-press menu:
// Edit your own text, Forward to another customer's chat, and Message info (who read it, when).
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import type { Customer, OrgUser } from '../../api/customers';
import { messageReaders, type Message } from '../../api/messages';
import { TextArea } from '../../components/form';
import { Button, ListRow, Notice, SearchField, Sheet } from '../../components/ui';
import { matchesCustomer } from '../../lib/customers';
import { formatDate, formatTime } from '../../lib/format';
import { colors, space, type } from '../../theme/tokens';

export function EditMessageSheet({ message, onClose, onSave, saving, error }: {
  message: Message | null;
  onClose: () => void;
  onSave: (text: string) => void;
  saving: boolean;
  error: string | null;
}) {
  const [text, setText] = useState('');
  useEffect(() => setText(message?.text ?? ''), [message?.id, message?.text]);
  const changed = !!text.trim() && text.trim() !== (message?.text ?? '').trim();
  return (
    <Sheet visible={!!message} onClose={onClose}>
      <View style={styles.body}>
        <Text style={type.heading}>Edit message</Text>
        {error ? <Notice text={error} /> : null}
        <TextArea label="Message" value={text} onChangeText={setText} autoCapitalize="sentences" />
        <View style={styles.buttons}>
          <View style={styles.flex}><Button label="Cancel" variant="secondary" onPress={onClose} /></View>
          <View style={styles.flex}><Button label="Save" onPress={() => onSave(text.trim())} disabled={!changed} loading={saving} /></View>
        </View>
      </View>
    </Sheet>
  );
}

/** Pick one or more customers (not this one), then Forward. */
export function ForwardSheet({ message, customers, currentId, onClose, onForward, sending, error }: {
  message: Message | null;
  customers: Customer[];
  currentId: string;
  onClose: () => void;
  onForward: (ids: string[]) => void;
  sending: boolean;
  error: string | null;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    setQuery('');
    setPicked([]);
  }, [message?.id]);
  const list = useMemo(
    () => customers.filter((c) => c.id !== currentId && matchesCustomer(c, query)).slice(0, 40),
    [customers, currentId, query],
  );
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <Sheet visible={!!message} onClose={onClose}>
      <View style={styles.body}>
        <Text style={type.heading}>Forward to</Text>
        {error ? <Notice text={error} /> : null}
        <SearchField value={query} onChangeText={setQuery} placeholder="Search customers" />
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {list.map((c) => (
            <ListRow
              key={c.id}
              avatar={c.name}
              title={c.name}
              subtitle={[c.customerCode, c.city].filter(Boolean).join(' · ') || undefined}
              right={picked.includes(c.id) ? <Check size={20} color={colors.primary} /> : undefined}
              onPress={() => toggle(c.id)}
            />
          ))}
          {list.length === 0 ? <Text style={[type.small, styles.none]}>No customers match.</Text> : null}
        </ScrollView>
        <Button
          label={picked.length > 1 ? `Forward to ${picked.length} customers` : 'Forward'}
          onPress={() => onForward(picked)}
          disabled={picked.length === 0}
          loading={sending}
        />
      </View>
    </Sheet>
  );
}

/** Who has read the message: the website's message info. */
export function MessageInfoSheet({ message, customerId, users, onClose }: {
  message: Message | null;
  customerId: string;
  users: OrgUser[];
  onClose: () => void;
}) {
  const readers = useQuery({
    queryKey: ['readers', message?.id],
    queryFn: () => messageReaders(customerId, message!.id),
    enabled: !!message,
  });
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? 'Team member';
  // The sender's own read doesn't count as "read by".
  const rows = (readers.data ?? []).filter((r) => r.userId !== message?.senderId);
  return (
    <Sheet visible={!!message} onClose={onClose}>
      <View style={styles.body}>
        <Text style={type.heading}>Message info</Text>
        {message ? <Text style={type.small}>Sent {formatDate(message.createdAt)}, {formatTime(message.createdAt)}{message.editedAt ? ` · edited ${formatTime(message.editedAt)}` : ''}</Text> : null}
        <Text style={type.label}>Read by</Text>
        {readers.error ? <Notice text={(readers.error as Error).message} /> : null}
        {readers.isLoading ? (
          <Text style={type.small}>Loading…</Text>
        ) : rows.length === 0 ? (
          <Text style={type.small}>Nobody else has read it yet.</Text>
        ) : (
          <ScrollView style={styles.list}>
            {rows.map((r) => (
              <ListRow key={r.userId} avatar={name(r.userId)} title={name(r.userId)} subtitle={`${formatDate(r.readAt)}, ${formatTime(r.readAt)}`} />
            ))}
          </ScrollView>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: space.md, paddingHorizontal: space.screen, paddingBottom: space.lg },
  buttons: { flexDirection: 'row', gap: space.md },
  list: { maxHeight: 360 },
  none: { paddingVertical: space.md },
});
