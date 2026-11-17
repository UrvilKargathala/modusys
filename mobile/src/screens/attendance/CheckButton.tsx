// The big round Check in / Check out button (design v2, Prompt 3; references:
// Clocky, Cotap): a 140pt circle inside two soft rings, the time under it, and
// what tapping it does. After check-out it becomes a small "done" card.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CircleCheck, Pointer } from 'lucide-react-native';
import type { AttendanceRecord } from '../../api/attendance';
import { Card, Skeleton } from '../../components/ui';
import { todayState } from '../../lib/attendance';
import { formatTime } from '../../lib/format';
import { colors, fonts, space, type } from '../../theme/tokens';

const BUTTON = 140;
const RING_1 = 180;
const RING_2 = 220;

/** The phone's clock as 09:42 AM, refreshed every 15 seconds. */
function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return formatTime(now);
}

export function CheckButton({ record, loading, onCheck }: {
  record: AttendanceRecord | null;
  loading: boolean;
  onCheck: (side: 'checkIn' | 'checkOut') => void;
}) {
  const clock = useClock();
  const state = todayState(record);

  if (loading) {
    return (
      <View style={styles.wrap}>
        <Skeleton width={RING_2} height={RING_2} round />
      </View>
    );
  }

  if (state === 'checked-out' && record?.checkOut) {
    return (
      <Card style={styles.done}>
        <View style={styles.doneIcon}>
          <CircleCheck size={24} color={colors.success} strokeWidth={1.5} />
        </View>
        <View style={styles.doneText}>
          <Text style={type.heading}>You're done for today</Text>
          <Text style={type.small}>Checked out at {formatTime(record.checkOut)}</Text>
        </View>
      </Card>
    );
  }

  const checkingOut = state === 'checked-in';
  const label = checkingOut ? 'Check out' : 'Check in';

  return (
    <View style={styles.wrap}>
      <View style={[styles.ring, styles.ring2]}>
        <View style={[styles.ring, styles.ring1]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint="Takes a selfie and your location"
            onPress={() => onCheck(checkingOut ? 'checkOut' : 'checkIn')}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: checkingOut ? colors.dark : colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Pointer size={34} color={colors.white} strokeWidth={1.5} />
            <Text style={styles.buttonLabel}>{label}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.clock}>{clock}</Text>
      <Text style={[type.small, styles.hint]}>We'll take a selfie and your location</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  // Exact half-size radii (Android can square off a larger radius).
  ring: { alignItems: 'center', justifyContent: 'center' },
  ring2: { width: RING_2, height: RING_2, borderRadius: RING_2 / 2, backgroundColor: colors.primaryTint },
  ring1: { width: RING_1, height: RING_1, borderRadius: RING_1 / 2, backgroundColor: colors.primarySoft },
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    shadowColor: colors.dark,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  buttonLabel: { color: colors.white, fontSize: 16, fontWeight: '600', fontFamily: fonts.body },
  clock: { ...type.kpi, fontSize: 26, marginTop: space.sm },
  hint: { textAlign: 'center' },
  done: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  doneIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.successTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { flex: 1, gap: 2 },
});
