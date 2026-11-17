// Customer detail (M4, design v2 Prompt 6): header with Call / WhatsApp /
// Directions / Email, then Overview · Notes · Photos. Overview shows the same
// fields as the web's customer panel; Notes is the customer's chat from the
// web with a composer pinned above the keyboard; Photos is the customer's gallery;
// linked quotes come with Quotes (M5), since a quote's total needs the pricing rules.
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, MessageCircle, MessageSquareText, Navigation, Phone } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { fullName } from '@shared/mock/architects';
import { getCustomer, listArchitects, listUsers, type Customer } from '../../api/customers';
import { listMedia } from '../../api/media';
import { listMessages, markNotesRead, sendNote } from '../../api/messages';
import { useUser } from '../../auth/AuthProvider';
import { Avatar, Card, EmptyState, InfoRow, Notice, Segmented, Skeleton, SkeletonRow, StageBadge } from '../../components/ui';
import { fullAddress, mapsUrl, telUrl, whatsappUrl } from '../../lib/customers';
import { formatDate, formatInrShort } from '../../lib/format';
import { stageOrFallback } from '../../lib/stages';
import { usePullRefresh } from '../../lib/usePullRefresh';
import type { RootStackParamList } from '../../navigation/types';
import { colors, space, touch, type } from '../../theme/tokens';
import { NoteComposer, NotesList } from './Notes';
import { Photos } from './Photos';
import { useStages } from './useStages';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerDetail'>;
type Tab = 'overview' | 'notes' | 'photos';

function Action({ icon: Icon, label, url }: { icon: LucideIcon; label: string; url: string | null }) {
  const off = !url;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={() => url && Linking.openURL(url).catch(() => undefined)}
      style={({ pressed }) => [styles.action, off && styles.off, pressed && styles.pressed]}
    >
      <View style={styles.actionIcon}>
        <Icon size={20} color={colors.primary} strokeWidth={1.5} />
      </View>
      <Text style={type.small}>{label}</Text>
    </Pressable>
  );
}

function Overview({ customer }: { customer: Customer }) {
  const architects = useQuery({
    queryKey: ['architects'],
    queryFn: listArchitects,
    enabled: !!customer.architectId,
    staleTime: 5 * 60_000,
  });
  const users = useQuery({ queryKey: ['users'], queryFn: listUsers, enabled: !!customer.siteManagerId, staleTime: 5 * 60_000 });
  const architect = architects.data?.find((a) => a.id === customer.architectId);
  const siteManager = users.data?.find((u) => u.id === customer.siteManagerId);
  const birthday = [customer.birthdayDay, customer.birthdayMonth].filter(Boolean).join(' ');

  return (
    <>
      <Card style={styles.info}>
        <InfoRow label="Mobile" value={customer.mobile} empty="Not added" />
        <InfoRow label="Email" value={customer.email} empty="Not added" />
        <InfoRow label="Address" value={fullAddress(customer)} empty="Not added" />
        <InfoRow label="GST No" value={customer.gst} />
        <InfoRow label="Birthday" value={birthday} />
      </Card>
      <Card style={styles.info}>
        <InfoRow
          label="Architect"
          value={architect ? fullName(architect) : customer.architectId && architects.isLoading ? 'Loading…' : ''}
          empty="Not associated"
        />
        <InfoRow
          label="Site manager"
          value={siteManager?.name ?? (customer.siteManagerId && users.isLoading ? 'Loading…' : '')}
          empty="Not assigned"
        />
        <InfoRow label="Final offer" value={customer.finalOfferLakh ? formatInrShort(customer.finalOfferLakh * 1e5) : ''} />
        <InfoRow label="In stage" value={`${customer.daysInStage} day${customer.daysInStage === 1 ? '' : 's'}`} />
        <InfoRow label="Last activity" value={formatDate(customer.lastActivity)} />
        <InfoRow label="Added" value={formatDate(customer.createdAt)} />
      </Card>
      <Text style={[type.small, styles.note]}>Linked quotes show here once Quotes arrive on the phone (M5).</Text>
    </>
  );
}

export function CustomerDetailScreen({ route }: Props) {
  const { id } = route.params;
  const user = useUser();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const stages = useStages();
  const customer = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id),
    // Show the row from the list straight away while the fresh copy loads.
    initialData: () => queryClient.getQueryData<Customer[]>(['customers'])?.find((c) => c.id === id),
    initialDataUpdatedAt: () => queryClient.getQueryState(['customers'])?.dataUpdatedAt,
  });
  const c = customer.data;
  const address = c ? fullAddress(c) : '';

  // Notes: the chat thread, refreshed every 15 s while the tab is open; opening it marks it read.
  // Photos: the customer's gallery, loaded when the tab opens.
  const photosOpen = tab === 'photos';
  const media = useQuery({ queryKey: ['media', id], queryFn: () => listMedia(id), enabled: photosOpen });

  const notesOpen = tab === 'notes';
  const messages = useQuery({
    queryKey: ['messages', id],
    queryFn: () => listMessages(id),
    enabled: notesOpen,
    refetchInterval: notesOpen ? 15_000 : false,
  });
  const users = useQuery({ queryKey: ['users'], queryFn: listUsers, enabled: notesOpen, staleTime: 5 * 60_000 });
  useEffect(() => {
    if (notesOpen) markNotesRead(id).catch(() => undefined);
  }, [notesOpen, id]);
  const send = useMutation({
    mutationFn: (text: string) => sendNote(id, text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', id] }),
  });
  const nameOf = (userId: string | null) => users.data?.find((u) => u.id === userId)?.name ?? 'Team member';

  const pull = usePullRefresh(() =>
    Promise.all([customer.refetch(), notesOpen ? messages.refetch() : null, photosOpen ? media.refetch() : null]),
  );

  // Keep the newest note in view: jump to the bottom when the notes load or one is added.
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const noteCount = messages.data?.length ?? 0;
  useEffect(() => {
    if (notesOpen && noteCount) requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
  }, [notesOpen, noteCount]);

  // The keyboard lifts the composer by however far this screen starts below the top of the window (the header).
  const rootRef = useRef<React.ComponentRef<typeof View>>(null);
  const [topOffset, setTopOffset] = useState(0);

  return (
    <SafeAreaView style={styles.fill} edges={['left', 'right', 'bottom']}>
      <View
        ref={rootRef}
        style={styles.fill}
        onLayout={() => rootRef.current?.measureInWindow((_x, y) => setTopOffset(y))}
      >
        {/* Padding on both platforms: with edge-to-edge on (android/gradle.properties), Android's
            adjustResize no longer shrinks the window, so the keyboard would cover the composer. */}
        <KeyboardAvoidingView style={styles.fill} behavior="padding" keyboardVerticalOffset={topOffset}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={pull.refreshing}
                onRefresh={pull.onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
            {customer.error ? <Notice text={(customer.error as Error).message} /> : null}

            <Card style={styles.head}>
              {c ? (
                <>
                  <Avatar name={c.name} size={64} />
                  <View style={styles.headText}>
                    <Text style={styles.headName} accessibilityRole="header">{c.name}</Text>
                    {[c.customerCode, c.city].filter(Boolean).length ? (
                      <Text style={type.small}>{[c.customerCode, c.city].filter(Boolean).join(' · ')}</Text>
                    ) : null}
                    <StageBadge stage={stageOrFallback(stages.byKey, c.stage)} />
                  </View>
                </>
              ) : (
                <>
                  <Skeleton width={64} height={64} round />
                  <View style={styles.headText}>
                    <Skeleton width="70%" height={20} />
                    <Skeleton width="40%" height={14} />
                  </View>
                </>
              )}
            </Card>

            <View style={styles.actions}>
              <Action icon={Phone} label="Call" url={c ? telUrl(c.mobile) : null} />
              <Action icon={MessageCircle} label="WhatsApp" url={c ? whatsappUrl(c.mobile) : null} />
              <Action icon={Navigation} label="Directions" url={mapsUrl(address)} />
              <Action icon={Mail} label="Email" url={c?.email ? `mailto:${c.email}` : null} />
            </View>

            <Segmented<Tab>
              options={[
                { key: 'overview', label: 'Overview' },
                { key: 'notes', label: 'Notes' },
                { key: 'photos', label: 'Photos' },
              ]}
              value={tab}
              onChange={setTab}
            />

            {tab === 'overview' && c ? <Overview customer={c} /> : null}
            {notesOpen ? (
              messages.isLoading ? (
                <Card style={styles.info}>
                  <SkeletonRow />
                  <SkeletonRow />
                </Card>
              ) : messages.error ? (
                <Notice text={(messages.error as Error).message} />
              ) : noteCount === 0 ? (
                <Card>
                  <EmptyState icon={MessageSquareText} title="No notes yet" text="Add the first one below. The team sees it in this customer's chat on the web." />
                </Card>
              ) : (
                <NotesList messages={messages.data ?? []} myId={user.id} nameOf={nameOf} />
              )
            ) : null}
            {photosOpen ? (
              media.isLoading ? (
                <Card style={styles.info}>
                  <SkeletonRow />
                  <SkeletonRow />
                </Card>
              ) : media.error ? (
                <Notice text={(media.error as Error).message} />
              ) : (
                <Photos customerId={id} media={media.data ?? []} onUploaded={() => media.refetch()} />
              )
            ) : null}
          </ScrollView>
          {notesOpen ? (
            <>
              {send.error ? (
                <View style={styles.sendError}>
                  <Notice text={(send.error as Error).message} />
                </View>
              ) : null}
              <NoteComposer
                sending={send.isPending}
                onSend={async (text) => {
                  try {
                    await send.mutateAsync(text);
                    return true;
                  } catch {
                    return false;
                  }
                }}
              />
            </>
          ) : null}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  body: { padding: space.screen, gap: space.screen, paddingBottom: space.xl },
  sendError: { paddingHorizontal: space.screen, paddingBottom: space.xs },
  off: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  headText: { flex: 1, gap: space.xs, alignItems: 'flex-start' },
  headName: { ...type.heading, fontSize: 20 },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { flex: 1, alignItems: 'center', gap: space.xs, minHeight: touch },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  info: { gap: space.sm },
  note: { textAlign: 'center' },
});
