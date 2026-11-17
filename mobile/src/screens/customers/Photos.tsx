// Customer photos (M4, design v2 Prompt 6): the customer's gallery from the
// web (CRM panel > Media), grouped by day, newest first. The first tile adds
// photos from the camera or the phone's gallery; uploads show their progress
// in place. Tap a photo for the full-screen viewer (swipe between photos).
// Videos and documents show as named tiles: open them on the web for now.
import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, ImagePlus, Images, Video, X } from 'lucide-react-native';
import { imageSource } from '../../api/client';
import { uploadPhoto, type MediaItem } from '../../api/media';
import { Button, Card, EmptyState, Notice, Sheet } from '../../components/ui';
import { pickSitePhotos, takeSitePhoto, type SitePhotosResult } from '../../lib/device';
import { formatDay, formatTime, istToday } from '../../lib/format';
import { colors, fonts, radius, space, type } from '../../theme/tokens';

const COLUMNS = 3;
const GAP = space.sm;

type Upload = { id: string; uri: string; progress: number; error?: string };

const ERRORS: Record<Exclude<SitePhotosResult, { ok: true }>['reason'], string | null> = {
  cancelled: null,
  'no-camera': 'This device has no camera. Choose from the gallery instead.',
  denied: 'Camera access is off for Modusys. Turn it on in Settings, then try again.',
  'too-big': 'That photo is too large to upload.',
  failed: "The photo couldn't be taken. Please try again.",
};

function dayLabel(iso: string): string {
  const day = istToday(new Date(iso));
  if (day === istToday()) return 'Today';
  if (day === istToday(new Date(Date.now() - 24 * 60 * 60 * 1000))) return 'Yesterday';
  return formatDay(day);
}

function Tile({ size, children, onPress, label }: { size: number; children: React.ReactNode; onPress?: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { width: size, height: size }, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

export function Photos({ customerId, media, onUploaded }: {
  customerId: string;
  media: MediaItem[];
  /** Refetch the gallery after an upload. */
  onUploaded: () => void;
}) {
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const size = Math.floor((width - space.screen * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
  const [choosing, setChoosing] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);

  // Newest first, grouped by IST day; the viewer pages through the photos in the same order.
  const sorted = useMemo(() => [...media].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)), [media]);
  const photos = useMemo(() => sorted.filter((m) => m.type === 'image'), [sorted]);
  const groups = useMemo(() => {
    const out: { label: string; items: MediaItem[] }[] = [];
    for (const m of sorted) {
      const label = dayLabel(m.uploadedAt);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(m);
      else out.push({ label, items: [m] });
    }
    return out;
  }, [sorted]);

  // iOS can't open the picker while the sheet is still sliding away, so it opens from the sheet's
  // onDismiss there; Android has no onDismiss and opens it straight away.
  const pending = useRef<'camera' | 'gallery' | null>(null);
  const choose = (from: 'camera' | 'gallery') => {
    setChoosing(false);
    if (Platform.OS === 'ios') pending.current = from;
    else add(from);
  };
  const onSheetGone = () => {
    const from = pending.current;
    pending.current = null;
    if (from) add(from);
  };

  const add = async (from: 'camera' | 'gallery') => {
    setError(null);
    const res = from === 'camera' ? await takeSitePhoto() : await pickSitePhotos();
    if (!res.ok) {
      const text = ERRORS[res.reason];
      if (text) setError(text);
      return;
    }
    const batch = res.photos.map((p, i) => ({ photo: p, id: `${Date.now()}-${i}` }));
    setUploads((u) => [...batch.map((b) => ({ id: b.id, uri: b.photo.uri, progress: 0 })), ...u]);
    await Promise.all(
      batch.map(async ({ photo, id }) => {
        try {
          await uploadPhoto(customerId, photo, (p) =>
            setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: p } : x))),
          );
          setUploads((u) => u.filter((x) => x.id !== id));
        } catch (e) {
          setUploads((u) => u.map((x) => (x.id === id ? { ...x, error: (e as Error).message } : x)));
        }
      }),
    );
    onUploaded();
    queryClient.invalidateQueries({ queryKey: ['media', customerId] });
  };

  const failed = uploads.filter((u) => u.error);

  return (
    <View style={styles.wrap}>
      {error ? <Notice text={error} /> : null}
      {failed.length ? <Notice text={failed[0].error ?? 'Upload failed.'} /> : null}

      <View style={styles.grid}>
        <Tile size={size} label="Add photo" onPress={() => setChoosing(true)}>
          <View style={styles.add}>
            <ImagePlus size={26} color={colors.primary} strokeWidth={1.5} />
            <Text style={styles.addText}>Add photo</Text>
          </View>
        </Tile>
        {uploads.map((u) => (
          <Tile key={u.id} size={size} label={u.error ? 'Upload failed' : 'Uploading'}>
            <Image source={{ uri: u.uri }} style={styles.img} />
            <View style={styles.overlay}>
              {u.error ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss failed upload"
                  onPress={() => setUploads((all) => all.filter((x) => x.id !== u.id))}
                  style={styles.dismiss}
                >
                  <X size={18} color={colors.white} />
                </Pressable>
              ) : (
                <>
                  <ActivityIndicator color={colors.white} />
                  <Text style={styles.progress}>{Math.round(u.progress * 100)}%</Text>
                </>
              )}
            </View>
          </Tile>
        ))}
      </View>

      {groups.length === 0 && uploads.length === 0 ? (
        <Card>
          <EmptyState icon={Images} title="No photos yet" text="Add site photos from the camera or your gallery. The team sees them on the web too." />
        </Card>
      ) : null}

      {groups.map((g) => (
        <View key={g.label} style={styles.group}>
          <Text style={type.label}>{g.label}</Text>
          <View style={styles.grid}>
            {g.items.map((m) =>
              m.type === 'image' ? (
                <Tile key={m.id} size={size} label={`Photo, ${formatTime(m.uploadedAt)}`} onPress={() => setViewing(photos.indexOf(m))}>
                  <Image source={imageSource(m.url)} style={styles.img} />
                </Tile>
              ) : (
                <Tile key={m.id} size={size} label={`${m.type === 'video' ? 'Video' : 'Document'}: ${m.name}`}>
                  <View style={styles.file}>
                    {m.type === 'video' ? (
                      <Video size={24} color={colors.primary} strokeWidth={1.5} />
                    ) : (
                      <FileText size={24} color={colors.primary} strokeWidth={1.5} />
                    )}
                    <Text style={styles.fileName} numberOfLines={2}>{m.name}</Text>
                  </View>
                </Tile>
              ),
            )}
          </View>
        </View>
      ))}

      <Sheet visible={choosing} onClose={() => setChoosing(false)} onDismiss={onSheetGone}>
        <View style={styles.sheetBody}>
          <Text style={type.heading} accessibilityRole="header">Add site photos</Text>
          <Button label="Take photo" onPress={() => choose('camera')} />
          <Button label="Choose from gallery" variant="secondary" onPress={() => choose('gallery')} />
          <Button label="Cancel" variant="text" onPress={() => setChoosing(false)} />
        </View>
      </Sheet>

      <Viewer photos={photos} index={viewing} onClose={() => setViewing(null)} />
    </View>
  );
}

/** Full-screen photos on black; swipe sideways between them. */
function Viewer({ photos, index, onClose }: { photos: MediaItem[]; index: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [current, setCurrent] = useState(0);
  const shown = index !== null && index >= 0;
  const item = photos[current];

  return (
    <Modal visible={shown} animationType="fade" onRequestClose={onClose} onShow={() => setCurrent(index ?? 0)} statusBarTranslucent>
      <View style={styles.viewer}>
        {shown ? (
          <FlatList
            data={photos}
            keyExtractor={(m) => m.id}
            horizontal
            pagingEnabled
            initialScrollIndex={index}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item: m }) => (
              <View style={{ width, height }}>
                <Image source={imageSource(m.url)} style={styles.full} resizeMode="contain" accessibilityLabel="Site photo" />
              </View>
            )}
          />
        ) : null}
        <SafeAreaView style={styles.viewerChrome} edges={['top', 'bottom']} pointerEvents="box-none">
          <View style={styles.viewerTop}>
            <Text style={styles.viewerCount}>{photos.length ? `${current + 1} / ${photos.length}` : ''}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.viewerClose}>
              <X size={22} color={colors.white} />
            </Pressable>
          </View>
          {item ? (
            <View style={styles.viewerBottom}>
              <Text style={styles.viewerText} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.viewerSub}>
                {formatDay(istToday(new Date(item.uploadedAt)))} · {formatTime(item.uploadedAt)}
              </Text>
            </View>
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  group: { gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.greyTint },
  pressed: { opacity: 0.7 },
  img: { width: '100%', height: '100%' },
  add: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    backgroundColor: colors.primaryTint,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primaryChip,
    borderRadius: radius.md,
  },
  addText: { ...type.small, color: colors.primary, fontWeight: '600' },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  progress: { color: colors.white, fontSize: 12, fontWeight: '600', fontFamily: fonts.number },
  dismiss: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  file: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xs, padding: space.sm, backgroundColor: colors.card },
  fileName: { ...type.small, textAlign: 'center' },
  sheetBody: { padding: space.screen, gap: space.sm, paddingBottom: space.xl },
  viewer: { flex: 1, backgroundColor: colors.black },
  full: { width: '100%', height: '100%' },
  viewerChrome: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'space-between' },
  viewerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.lg },
  viewerCount: { color: colors.white, fontSize: 15, fontFamily: fonts.number },
  viewerClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.onBlackButton, alignItems: 'center', justifyContent: 'center' },
  viewerBottom: { padding: space.lg, gap: 2 },
  viewerText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  viewerSub: { color: colors.onPrimaryMuted, fontSize: 13 },
});
