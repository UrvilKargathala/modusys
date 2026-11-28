// CRM > Tickets (M5b step 5b): the website's pipeline on the phone. Pending-tasks strip, stage / filters / sort,
// search, then the Board (one stage per screen width, swipe sideways) or the List (a section per stage).
// Tap a card to open the customer; long-press it to move it to another stage (the website drags it instead).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTabBarScroll } from '../../navigation/tabBarScroll';
import { FlatList, Pressable, RefreshControl, SectionList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '../../components/Text';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpDown, Check, ChevronDown, ChevronRight, Clock, Columns3, List, ListTodo, MapPin, SlidersHorizontal } from 'lucide-react-native';
import { changeStage, listCustomers, setStageDone, type Customer } from '../../api/customers';
import { OptionSheet } from '../../components/form';
import { Glass } from '../../components/glass';
import { Button, Card, EmptyState, Notice, SearchField, Sheet, SkeletonRow, TextField, useTabBarSpace } from '../../components/ui';
import { matchesCustomer } from '../../lib/customers';
import { formatDate } from '../../lib/format';
import { byStage, customerSortOptions, inOfferRange, taskSummary, type CustomerSortOption, type OfferFilter } from '../../lib/pipeline';
import { stageOrFallback, type Stage } from '../../lib/stages';
import { usePullRefresh } from '../../lib/usePullRefresh';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radius, shadow, space, touch, type } from '../../theme/tokens';
import { useStages } from '../customers/useStages';
import { useCrmTasks, useToday, useUserNames } from '../tasks/taskParts';

type View_ = 'board' | 'list';
const ALL = 'all';

/** "₹12.5L", as on the website's cards. */
const lakh = (v: number) => `₹${v.toFixed(1)}L`;

function TaskStrip({ onOpenTasks }: { onOpenTasks: () => void }) {
  const tasks = useCrmTasks();
  const userName = useUserNames();
  const { today } = useToday();
  const s = useMemo(() => taskSummary(tasks.data ?? [], today), [tasks.data, today]);
  if (!s.total) return null;
  const Icon = s.overdue ? AlertTriangle : ListTodo;
  return (
    <Glass style={styles.strip}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${s.total} pending tasks. Open tasks`} onPress={onOpenTasks} style={({ pressed }) => [styles.stripInner, pressed && styles.dim]}>
      <View style={styles.stripIcon}><Icon size={16} color={s.overdue ? colors.error : colors.text} strokeWidth={1.75} /></View>
      <View style={styles.flex}>
        <Text style={[type.body, styles.bold]}>
          {s.total} pending task{s.total === 1 ? '' : 's'}
          {s.overdue ? <Text style={styles.red}> — {s.overdue} overdue</Text> : null}
          {s.dueSoon ? <Text style={styles.amber}> — {s.dueSoon} due soon</Text> : null}
        </Text>
        {s.spotlight ? (
          <Text style={type.small} numberOfLines={1}>
            {s.spotlightDaysLate ? <Clock size={11} color={colors.error} /> : null}
            {s.spotlightDaysLate ? ` "${s.spotlight.title}" ` : `Next up: "${s.spotlight.title}"`}
            {s.spotlightDaysLate ? <Text style={styles.red}>({s.spotlightDaysLate}d late)</Text> : s.spotlight.dueDate ? ` · ${formatDate(s.spotlight.dueDate)}` : ''}
            {tasks.seesAll && userName(s.spotlight.assigneeId) ? `, assigned to ${userName(s.spotlight.assigneeId)}` : ''}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={18} color={colors.textSecondary} strokeWidth={1.5} />
    </Pressable>
    </Glass>
  );
}

/** A card as on the website's board: stage colour bar, name in the stage colour, address, Final Offer; then the
 * website list's Last Activity and Assignee. */
function TicketCard({ customer, stage, onOpen, onMove, onToggleDone }: {
  customer: Customer;
  stage: Stage;
  onOpen: () => void;
  onMove: () => void;
  onToggleDone: () => void;
}) {
  const done = (customer.completedStages ?? []).includes(customer.stage);
  return (
    <Glass style={styles.card}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${customer.name}, ${stage.label}`}
      accessibilityHint="Long-press to move it to another stage"
      onPress={onOpen}
      onLongPress={onMove}
      delayLongPress={350}
      style={({ pressed }) => [styles.cardInner, pressed && styles.dim]}
    >
      <View style={[styles.cardBar, { backgroundColor: stage.color }]} />
      <View style={styles.cardHead}>
        <Text style={[type.body, styles.bold, styles.flex, { color: stage.color }]} numberOfLines={2}>{customer.name}</Text>
        {/* The website card's tick: this stage is done (shared with the website). */}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={done ? 'Mark stage pending' : 'Mark stage complete'}
          onPress={onToggleDone}
          hitSlop={10}
          style={[styles.tickBox, done && styles.tickBoxOn]}
        >
          {done ? <Check size={14} color={colors.white} strokeWidth={3} /> : null}
        </Pressable>
      </View>
      {customer.address || customer.city ? (
        <View style={styles.addr}>
          <MapPin size={12} color={colors.placeholder} strokeWidth={1.75} />
          <Text style={[type.small, styles.flex]} numberOfLines={2}>{customer.address || customer.city}</Text>
        </View>
      ) : null}
      {customer.finalOfferLakh !== null ? <Text style={styles.offer}>Final Offer: <Text style={styles.number}>{lakh(customer.finalOfferLakh)}</Text></Text> : null}
      <View style={styles.meta}>
        <Clock size={11} color={colors.placeholder} strokeWidth={1.75} />
        <Text style={type.small} numberOfLines={1}>{formatDate(customer.lastActivity).slice(0, 5)}</Text>
        {customer.assignee ? <Text style={[type.small, styles.flex]} numberOfLines={1}>· {customer.assignee}</Text> : null}
      </View>
    </Pressable>
    </Glass>
  );
}

/** Toolbar button: icon and text, or icon only (the label is then read out, not shown). Highlighted while in use. */
function ToolButton({ icon: Icon, label, active, iconOnly, onPress }: { icon: typeof List; label: string; active?: boolean; iconOnly?: boolean; onPress: () => void }) {
  return (
    <Glass style={[styles.tool, iconOnly ? styles.toolIcon : styles.flex, active && styles.toolOn]} interactive>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.toolInner, pressed && styles.dim]}>
        <Icon size={16} color={active ? colors.primary : colors.text} strokeWidth={1.75} />
        {iconOnly ? null : <Text style={[type.label, styles.toolText, active && styles.toolTextOn]} numberOfLines={1}>{label}</Text>}
      </Pressable>
    </Glass>
  );
}

export function TicketsPanel({ onOpenTasks }: { onOpenTasks: () => void }) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const bottomSpace = useTabBarSpace();
  const onTabScroll = useTabBarScroll();
  const { width } = useWindowDimensions();
  const stages = useStages();
  const customers = useQuery({ queryKey: ['customers'], queryFn: listCustomers });
  const pull = usePullRefresh(() => customers.refetch());

  const [view, setView] = useState<View_>('board');
  const [stageKey, setStageKey] = useState<string>(ALL);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CustomerSortOption>('last-activity');
  const [offer, setOffer] = useState<OfferFilter>({ min: '', max: '' });
  const [draft, setDraft] = useState<OfferFilter>({ min: '', max: '' });
  const [sheet, setSheet] = useState<'stage' | 'sort' | 'filters' | null>(null);
  const [moving, setMoving] = useState<Customer | null>(null);
  const [folded, setFolded] = useState<Set<string>>(new Set());

  // Search like the Customers list (name, mobile, code, city) plus the address, as the website's search does.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (customers.data ?? []).filter(
      (c) => (stageKey === ALL || c.stage === stageKey) && (matchesCustomer(c, query) || (!!q && c.address.toLowerCase().includes(q))) && inOfferRange(c, offer),
    );
  }, [customers.data, stageKey, query, offer]);
  const grouped = useMemo(() => byStage(shown, sort), [shown, sort]);
  // The board / list stages: all active ones (as the website), or only the picked one.
  const columns = useMemo(() => {
    const active = stages.active.filter((s) => stageKey === ALL || s.key === stageKey);
    // A customer in a retired stage still shows, under its old stage name, after the active ones.
    const extra = [...grouped.keys()].filter((k) => !stages.active.some((s) => s.key === k)).map((k) => stageOrFallback(stages.byKey, k));
    return [...active, ...extra];
  }, [stages, stageKey, grouped]);

  const move = useMutation({
    mutationFn: ({ c, key }: { c: Customer; key: string }) => changeStage(c.id, key, stageOrFallback(stages.byKey, key).label),
    onSuccess: (_u, { c }) =>
      Promise.all([queryClient.invalidateQueries({ queryKey: ['customers'] }), queryClient.invalidateQueries({ queryKey: ['customer', c.id] }), queryClient.invalidateQueries({ queryKey: ['messages', c.id] })]),
  });

  // The stage tick shows at once; the list reloads from the server afterwards.
  const tick = useMutation({
    mutationFn: (c: Customer) => setStageDone(c, !(c.completedStages ?? []).includes(c.stage)),
    onMutate: (c) =>
      queryClient.setQueryData<Customer[]>(['customers'], (list) =>
        list?.map((x) => {
          if (x.id !== c.id) return x;
          const has = (x.completedStages ?? []).includes(x.stage);
          return { ...x, completedStages: has ? (x.completedStages ?? []).filter((s) => s !== x.stage) : [...(x.completedStages ?? []), x.stage] };
        }),
      ),
    onSettled: (_r, _e, c) =>
      Promise.all([queryClient.invalidateQueries({ queryKey: ['customers'] }), queryClient.invalidateQueries({ queryKey: ['customer', c.id] })]),
  });
  const open = (c: Customer) => nav.navigate('CustomerDetail', { id: c.id, name: c.name });
  const filtersOn = !!(offer.min.trim() || offer.max.trim());
  const sortLabel = customerSortOptions.find((o) => o.value === sort)?.label ?? '';
  const colWidth = width - space.screen * 2;
  const pageWidth = colWidth + space.md;

  // The board shows one stage at a time, so a search whose matches are all in other stages would read
  // "No customers in this stage". Jump to the first stage that has a match instead.
  const board = useRef<FlatList<Stage>>(null);
  const page = useRef(0);
  const searching = !!query.trim() || filtersOn;
  useEffect(() => {
    if (view !== 'board' || !searching) return;
    const count = (s?: Stage) => (s ? grouped.get(s.key)?.length ?? 0 : 0);
    if (count(columns[page.current]) > 0) return;
    const first = columns.findIndex((s) => count(s) > 0);
    if (first < 0) return;
    page.current = first;
    board.current?.scrollToOffset({ offset: first * pageWidth, animated: true });
  }, [view, searching, grouped, columns, pageWidth]);
  const refresh = <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.primary} colors={[colors.primary]} />;

  const card = (c: Customer) => (
    <TicketCard
      key={c.id}
      customer={c}
      stage={stageOrFallback(stages.byKey, c.stage)}
      onOpen={() => open(c)}
      onMove={() => setMoving(c)}
      onToggleDone={() => tick.mutate(c)}
    />
  );

  const top = (
    <View style={styles.top}>
      <TaskStrip onOpenTasks={onOpenTasks} />
      <View style={styles.tools}>
        <ToolButton icon={ChevronDown} label={stageKey === ALL ? 'All stages' : stageOrFallback(stages.byKey, stageKey).label} active={stageKey !== ALL} onPress={() => setSheet('stage')} />
        <ToolButton icon={SlidersHorizontal} label="Filters" active={filtersOn} onPress={() => { setDraft(offer); setSheet('filters'); }} />
        <ToolButton icon={ArrowUpDown} label={`Sort: ${sortLabel}`} iconOnly active={sort !== 'last-activity'} onPress={() => setSheet('sort')} />
        <ToolButton icon={view === 'board' ? List : Columns3} label={view === 'board' ? 'Show as list' : 'Show as board'} iconOnly onPress={() => setView(view === 'board' ? 'list' : 'board')} />
      </View>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search name, mobile, address or city" />
      {customers.error ? <Notice text={(customers.error as Error).message} /> : null}
      {move.error ? <Notice text={`Stage not changed: ${(move.error as Error).message}`} /> : null}
      {tick.error ? <Notice text={`Tick not saved: ${(tick.error as Error).message}`} /> : null}
      {view === 'board' && columns.length > 1 ? <Text style={type.small}>Swipe sideways for the next stage · long-press a card to move it</Text> : null}
    </View>
  );

  return (
    <View style={styles.fill}>
      {customers.isLoading ? (
        <View style={styles.pad}>{top}<Card style={styles.gap}><SkeletonRow /><SkeletonRow /><SkeletonRow /></Card></View>
      ) : view === 'board' ? (
        <View style={styles.fill}>
          <View style={styles.pad}>{top}</View>
          <FlatList
            ref={board}
            horizontal
            data={columns}
            keyExtractor={(s) => s.key}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => { page.current = Math.round(e.nativeEvent.contentOffset.x / pageWidth); }}
            snapToInterval={pageWidth}
            decelerationRate="fast"
            // One stage per swipe, however quick the swipe.
            disableIntervalMomentum
            contentContainerStyle={styles.board}
            renderItem={({ item: stage }) => {
              const list = grouped.get(stage.key) ?? [];
              return (
                <Glass style={[styles.column, { width: colWidth }]}>
                  <View style={styles.colHead}>
                    <View style={[styles.dot, { backgroundColor: stage.color }]} />
                    <Text style={[type.heading, styles.flex]} numberOfLines={1}>{stage.label}</Text>
                    <Text style={[type.label, styles.count]}>{list.length}</Text>
                  </View>
                  <FlatList
                    data={list}
                    keyExtractor={(c) => c.id}
                    renderItem={({ item }) => card(item)}
                    nestedScrollEnabled
                    onScroll={onTabScroll}
                    scrollEventThrottle={32}
                    refreshControl={refresh}
                    contentContainerStyle={[styles.colBody, { paddingBottom: bottomSpace }]}
                    ListEmptyComponent={<Text style={[type.small, styles.none]}>No customers in this stage.</Text>}
                    initialNumToRender={8}
                  />
                </Glass>
              );
            }}
          />
        </View>
      ) : (
        <SectionList
          sections={columns.map((s) => ({ stage: s, key: s.key, data: folded.has(s.key) ? [] : grouped.get(s.key) ?? [] }))}
          keyExtractor={(c) => c.id}
          onScroll={onTabScroll}
          scrollEventThrottle={32}
          ListHeaderComponent={top}
          renderSectionHeader={({ section }) => {
            const n = grouped.get(section.key)?.length ?? 0;
            const isFolded = folded.has(section.key);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: !isFolded }}
                accessibilityLabel={`${section.stage.label}, ${n} customers`}
                onPress={() => setFolded((f) => { const next = new Set(f); if (next.has(section.key)) next.delete(section.key); else next.add(section.key); return next; })}
                style={styles.section}
              >
                {isFolded ? <ChevronRight size={18} color={colors.textSecondary} /> : <ChevronDown size={18} color={colors.textSecondary} />}
                <View style={[styles.dot, { backgroundColor: section.stage.color }]} />
                <Text style={[type.heading, styles.flex]} numberOfLines={1}>{section.stage.label}</Text>
                <Text style={[type.label, styles.count]}>{n}</Text>
              </Pressable>
            );
          }}
          renderItem={({ item }) => <View style={styles.listItem}>{card(item)}</View>}
          stickySectionHeadersEnabled={false}
          refreshControl={refresh}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.pad, { paddingBottom: bottomSpace }]}
          ListEmptyComponent={<EmptyState icon={List} title="No customers" text="Nothing matches these filters." />}
        />
      )}

      <OptionSheet
        visible={sheet === 'stage'}
        onClose={() => setSheet(null)}
        title="Show stage"
        value={stageKey}
        options={[{ key: ALL, label: 'All stages' }, ...stages.active.map((s) => ({ key: s.key, label: s.label }))]}
        onPick={setStageKey}
      />
      <OptionSheet
        visible={sheet === 'sort'}
        onClose={() => setSheet(null)}
        title="Sort cards by"
        value={sort}
        options={customerSortOptions.map((o) => ({ key: o.value, label: o.label }))}
        onPick={setSort}
      />
      <Sheet visible={sheet === 'filters'} onClose={() => setSheet(null)}>
        <View style={styles.filters}>
          <Text style={type.heading} accessibilityRole="header">Filters</Text>
          <Text style={type.label}>Final offer value (₹L)</Text>
          <View style={styles.row}>
            <View style={styles.flex}><TextField label="From" placeholder="Min" keyboardType="decimal-pad" value={draft.min} onChangeText={(min) => setDraft((d) => ({ ...d, min }))} /></View>
            <View style={styles.flex}><TextField label="To" placeholder="Max" keyboardType="decimal-pad" value={draft.max} onChangeText={(max) => setDraft((d) => ({ ...d, max }))} /></View>
          </View>
          <View style={styles.row}>
            <View style={styles.flex}><Button label="Clear" variant="secondary" onPress={() => { setOffer({ min: '', max: '' }); setSheet(null); }} /></View>
            <View style={styles.flex}><Button label="Apply" onPress={() => { setOffer(draft); setSheet(null); }} /></View>
          </View>
        </View>
      </Sheet>
      <OptionSheet
        visible={!!moving}
        onClose={() => setMoving(null)}
        title={moving ? `Move ${moving.name} to` : 'Move to'}
        value={moving?.stage ?? ''}
        options={stages.active.map((s) => ({ key: s.key, label: s.label }))}
        onPick={(key) => { if (moving && key !== moving.stage) move.mutate({ c: moving, key }); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  pad: { paddingHorizontal: space.screen },
  gap: { gap: space.sm },
  dim: { opacity: 0.6 },
  bold: { fontWeight: '600' },
  red: { color: colors.error },
  amber: { color: colors.warningText },
  number: { fontFamily: fonts.number },
  top: { gap: space.md, paddingTop: space.md, paddingBottom: space.md },
  strip: { backgroundColor: colors.errorTint, borderRadius: radius.lg },
  stripInner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  stripIcon: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  tools: { flexDirection: 'row', gap: space.sm },
  tool: { minHeight: touch - 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  toolInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: space.sm },
  toolIcon: { width: touch - 6 },
  toolOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  toolText: { color: colors.text, flexShrink: 1 },
  toolTextOn: { color: colors.primary },
  board: { paddingHorizontal: space.screen, gap: space.md },
  column: { backgroundColor: colors.greyTint, borderRadius: radius.lg, overflow: 'hidden' },
  colHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.md },
  colBody: { paddingHorizontal: space.sm, gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  count: { color: colors.text, fontFamily: fonts.number },
  none: { textAlign: 'center', paddingVertical: space.xl },
  card: { backgroundColor: colors.card, borderRadius: radius.md, overflow: 'hidden', ...shadow },
  cardInner: { paddingVertical: space.md, paddingLeft: space.lg, paddingRight: space.md, gap: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  tickBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.placeholder, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  tickBoxOn: { backgroundColor: colors.success, borderColor: colors.success },
  cardBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  addr: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  offer: { ...type.small, color: colors.text, fontWeight: '600' },
  section: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch, marginTop: space.sm },
  listItem: { marginBottom: space.sm },
  filters: { paddingHorizontal: space.screen, paddingBottom: space.lg, gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
});
