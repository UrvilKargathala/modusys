// Small pieces shared by the attendance screens.
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { ImageOff } from 'lucide-react-native';
import { imageSource } from '../../api/client';
import { colors, radius, space, type } from '../../theme/tokens';

/** A selfie stored on the server (login-gated /api/files/... link). */
export function Selfie({ path, label, size = 72 }: { path: string | null; label: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.selfie}>
      {path && !failed ? (
        <Image
          source={imageSource(path)}
          style={[styles.photo, { width: size, height: size * (4 / 3) }]}
          accessibilityLabel={`${label} selfie`}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={[styles.photo, styles.missing, { width: size, height: size * (4 / 3) }]}>
          <ImageOff size={20} color={colors.placeholder} strokeWidth={1.5} />
        </View>
      )}
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

/** "Label   value" line used on the cards and the day sheet. */
export function Row({ label, value, lines }: { label: string; value: string | null | undefined; lines?: number }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={[type.label, styles.rowLabel]}>{label}</Text>
      <Text style={[type.body, styles.rowValue]} numberOfLines={lines}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  selfie: { alignItems: 'center', gap: space.xs },
  photo: { borderRadius: radius.sm, backgroundColor: colors.greyTint },
  missing: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: space.md },
  rowLabel: { width: 96 },
  rowValue: { flex: 1 },
});
