// The quote row the read-only quote figures share (admin Home's Recent quotes, a customer's quotes). Quotes open on the
// web only, so a row is plain text.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import type { QuoteSummary } from '../../api/business';
import { StatusBadge } from '../../components/ui';
import { formatDate, formatInrWhole } from '../../lib/format';
import { colors, fonts, radius, space, type } from '../../theme/tokens';

/** A list row: title line (+ small tag), up to two grey lines, amount on the right with a pill under it. */
function MoneyRow({ title, tag, lines, amount, badge, label, quietLines }: {
  title: string;
  tag?: string;
  lines: string[];
  /** Every line small and grey (by default the first line is body text). */
  quietLines?: boolean;
  amount: string;
  badge: React.ReactNode;
  label: string;
}) {
  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      <View style={styles.rowText}>
        <View style={styles.titleLine}>
          <Text style={styles.number} numberOfLines={1}>{title}</Text>
          {tag ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ) : null}
        </View>
        {lines.filter(Boolean).map((l, i) => (
          <Text key={i} style={i === 0 && !quietLines ? styles.line : type.small} numberOfLines={1}>{l}</Text>
        ))}
      </View>
      <View style={styles.right}>
        <Text style={styles.amount} numberOfLines={1}>{amount}</Text>
        {badge}
      </View>
    </View>
  );
}

const revisionTag = (revision: number) => (revision > 0 ? `Rev ${revision}` : undefined);

/** One quote inside a card: number (+ revision), customer and date, amount with the status badge. */
export function QuoteRow({ quote, showCustomer = true }: { quote: QuoteSummary; showCustomer?: boolean }) {
  const amount = formatInrWhole(quote.amount);
  return (
    <MoneyRow
      title={quote.quoteNumber}
      tag={revisionTag(quote.revision)}
      lines={showCustomer ? [quote.customerName, formatDate(quote.date)] : [formatDate(quote.date)]}
      amount={amount}
      badge={<StatusBadge status={quote.status} />}
      quietLines={!showCustomer}
      label={`${quote.quoteNumber}, ${showCustomer ? `${quote.customerName}, ` : ''}${amount}`}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  rowText: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  number: { ...type.body, fontWeight: '600', fontFamily: fonts.number, flexShrink: 1 },
  tag: { backgroundColor: colors.primaryTint, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  line: { ...type.body, color: colors.text },
  right: { alignItems: 'flex-end', gap: space.xs, maxWidth: '48%' },
  amount: { ...type.body, fontWeight: '600', fontFamily: fonts.number },
});
