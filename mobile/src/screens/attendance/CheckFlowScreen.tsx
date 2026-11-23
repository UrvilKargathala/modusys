// Check in / Check out in three steps, like the web: location, selfie, confirm
// (design v2, Prompt 4). GPS is best-effort (the server accepts a check-in
// without it); the selfie is required, and taking and sending it is the
// consent, exactly as on the web. The selfie is taken in the app (M6d): the front camera's live picture inside the
// face frame (SelfieCamera, react-native-vision-camera). Without a front camera (simulator) it falls back to the
// phone's own camera app (react-native-image-picker), as before.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SelfieCamera, type SelfieCameraHandle, type SelfieCameraState } from './SelfieCamera';
import { Animated, Image, Linking, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { CircleCheck, MapPin, MapPinOff, ScanFace } from 'lucide-react-native';
import { checkIn, checkOut, placeName, uploadSelfie, type Side } from '../../api/attendance';
import { Button, Card, Notice, TextField } from '../../components/ui';
import { getLocation, pickTestPhoto, takeSelfie, type Position, type SelfieResult } from '../../lib/device';
import { formatTime } from '../../lib/format';
import type { RootStackParamList } from '../../navigation/types';
import { colors, radius, space, type } from '../../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'CheckFlow'>;
type Step = 'location' | 'selfie' | 'confirm' | 'success';
type Place =
  | { status: 'finding' }
  | { status: 'found'; position: Position; label: string | null }
  | { status: 'failed'; reason: 'denied' | 'unavailable' | 'timeout' }
  | { status: 'skipped' };

const STEPS: { key: Exclude<Step, 'success'>; label: string }[] = [
  { key: 'location', label: 'Location' },
  { key: 'selfie', label: 'Selfie' },
  { key: 'confirm', label: 'Confirm' },
];

const SELFIE_ERRORS: Record<Exclude<SelfieResult, { ok: true }>['reason'], string | null> = {
  cancelled: null,
  'no-camera': 'This device has no camera. Use a phone to check in.',
  denied: 'Camera access is off for Modusys. Turn it on in Settings, then try again.',
  'too-big': 'That photo is too large. Please retake it.',
  failed: "The photo couldn't be taken. Please try again.",
};

export function CheckFlowScreen({ route, navigation }: Props) {
  const side: Side = route.params.side;
  const verb = side === 'checkIn' ? 'Check in' : 'Check out';
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('location');
  const [place, setPlace] = useState<Place>({ status: 'finding' });
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<{ text: string; settings: boolean; noCamera: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [doneAt, setDoneAt] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: verb, headerBackVisible: step !== 'success', gestureEnabled: step !== 'success' });
  }, [navigation, verb, step]);

  const findPlace = useCallback(async () => {
    setPlace({ status: 'finding' });
    const res = await getLocation();
    if (!res.ok) {
      setPlace({ status: 'failed', reason: res.reason });
      return;
    }
    // The name is a nice-to-have: coordinates alone are enough for the server.
    const label = await placeName(res.position.latitude, res.position.longitude)
      .then((r) => r.label)
      .catch(() => null);
    setPlace({ status: 'found', position: res.position, label });
  }, []);

  useEffect(() => {
    findPlace();
  }, [findPlace]);

  const camera = useRef<SelfieCameraHandle>(null);
  const [camState, setCamState] = useState<SelfieCameraState>('starting');
  const [shooting, setShooting] = useState(false);

  const capture = async (source: 'live' | 'app' | 'library' = 'live') => {
    setPhotoError(null);
    if (source === 'live') setShooting(true);
    const res =
      source === 'library' ? await pickTestPhoto()
      : source === 'live' && camera.current ? await camera.current.capture()
      : await takeSelfie();
    setShooting(false);
    if (res.ok) {
      setPhoto(res.photo.uri);
      return;
    }
    const text = SELFIE_ERRORS[res.reason];
    if (text) setPhotoError({ text, settings: res.reason === 'denied', noCamera: res.reason === 'no-camera' });
  };

  const send = async () => {
    if (!photo) return;
    setSending(true);
    setSendError(null);
    try {
      const { key } = await uploadSelfie(photo, side);
      const body = {
        photoKey: key,
        note: note.trim() || undefined,
        ...(place.status === 'found'
          ? { latitude: place.position.latitude, longitude: place.position.longitude }
          : {}),
      };
      const { record } = side === 'checkIn' ? await checkIn(body) : await checkOut(body);
      setDoneAt(side === 'checkIn' ? record.checkIn : (record.checkOut ?? new Date().toISOString()));
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setStep('success');
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (step === 'success') {
    return (
      <StepLayout footer={<Button label="Done" onPress={() => navigation.goBack()} />}>
        <View style={styles.success}>
          <View style={styles.successRing}>
            <CircleCheck size={56} color={colors.success} strokeWidth={1.5} />
          </View>
          <Text style={styles.successTitle} accessibilityRole="header">
            {side === 'checkIn' ? 'Checked in' : 'Checked out'} at {formatTime(doneAt)}
          </Text>
          {place.status === 'found' && place.label ? (
            <View style={styles.inlinePlace}>
              <MapPin size={14} color={colors.textSecondary} strokeWidth={1.5} />
              <Text style={[type.small, styles.center]}>{place.label}</Text>
            </View>
          ) : null}
          <Text style={[type.body, styles.muted, styles.center]}>It shows on the web's attendance pages right away.</Text>
        </View>
      </StepLayout>
    );
  }

  if (step === 'location') {
    return (
      <StepLayout
        step={step}
        footer={
          place.status === 'found' ? (
            <Button label="Continue" onPress={() => setStep('selfie')} />
          ) : place.status === 'failed' ? (
            <>
              {place.reason === 'denied' ? (
                <Button label="Open Settings" onPress={() => Linking.openSettings()} />
              ) : (
                <Button label="Try again" onPress={findPlace} />
              )}
              <Button
                label={`${verb} without location`}
                variant="text"
                onPress={() => {
                  setPlace({ status: 'skipped' });
                  setStep('selfie');
                }}
              />
            </>
          ) : null
        }
      >
        <PlaceView place={place} />
      </StepLayout>
    );
  }

  if (step === 'selfie') {
    return (
      <StepLayout
        step={step}
        footer={
          <>
            {photoError?.settings || (!photo && camState === 'denied') ? <Button label="Open Settings" onPress={() => Linking.openSettings()} /> : null}
            {(photoError?.noCamera || camState === 'no-camera') && __DEV__ && !photo ? (
              <Button label="Use a saved photo (simulator only)" variant="secondary" onPress={() => capture('library')} />
            ) : null}
            {photo ? (
              <>
                <Button label="Use photo" onPress={() => setStep('confirm')} />
                <Button label="Retake" variant="text" onPress={() => { setPhoto(null); setPhotoError(null); }} />
              </>
            ) : camState === 'ready' ? (
              <Button label="Take selfie" onPress={() => capture('live')} loading={shooting} />
            ) : camState === 'no-camera' ? (
              <Button label="Open camera" onPress={() => capture('app')} />
            ) : null}
          </>
        }
      >
        <FaceFrame photo={photo} live={<SelfieCamera ref={camera} active={step === 'selfie' && !photo} onState={setCamState} />} />
        <Text style={[type.body, styles.muted, styles.center]}>
          {photo
            ? 'Is your face clear and inside the frame?'
            : camState === 'denied'
              ? 'Camera access is off for Modusys. Turn it on in Settings to take your selfie.'
              : 'Keep your face inside the frame, in good light.'}
        </Text>
        {photoError ? <Notice text={photoError.text} /> : null}
      </StepLayout>
    );
  }

  // Confirm
  return (
    <StepLayout
      step={step}
      footer={
        <>
          <Button label={verb} onPress={send} loading={sending} />
          <Button label="Retake selfie" variant="text" onPress={() => setStep('selfie')} disabled={sending} />
        </>
      }
    >
      <Card>
        <View style={styles.confirm}>
          {photo ? <Image source={{ uri: photo }} style={styles.thumb} accessibilityLabel="Your selfie" /> : null}
          <View style={styles.confirmText}>
            <Text style={type.label}>{verb} at</Text>
            <Text style={styles.confirmTime}>{formatTime(new Date())}</Text>
            <View style={styles.inlinePlace}>
              {place.status === 'found' ? (
                <MapPin size={14} color={colors.textSecondary} strokeWidth={1.5} />
              ) : (
                <MapPinOff size={14} color={colors.textSecondary} strokeWidth={1.5} />
              )}
              <Text style={[type.small, styles.flex]} numberOfLines={2}>{placeText(place)}</Text>
            </View>
          </View>
        </View>
      </Card>
      <TextField
        label="Note (optional)"
        placeholder="Working at site, Vesu"
        value={note}
        onChangeText={setNote}
        maxLength={300}
      />
      {sendError ? <Notice text={sendError} /> : null}
    </StepLayout>
  );
}

/** Progress bar on top, content in the middle, buttons pinned to the bottom. */
function StepLayout({ step, children, footer }: { step?: Exclude<Step, 'success'>; children: React.ReactNode; footer?: React.ReactNode }) {
  const index = step ? STEPS.findIndex((s) => s.key === step) : -1;
  return (
    <SafeAreaView style={styles.fill} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step ? (
          <View style={styles.progress} accessible accessibilityLabel={`Step ${index + 1} of 3, ${STEPS[index].label}`}>
            <View style={styles.progressBars}>
              {STEPS.map((s, i) => (
                <View key={s.key} style={[styles.progressBar, i <= index && styles.progressOn]} />
              ))}
            </View>
            <Text style={type.label}>
              Step {index + 1} of 3 · {STEPS[index].label}
            </Text>
          </View>
        ) : null}
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

/** Soft pulsing ring behind the pin while the phone looks for a position. */
function Pulse() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.25, duration: 900, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return <Animated.View style={[styles.pulse, { transform: [{ scale }] }]} />;
}

function PlaceView({ place }: { place: Place }) {
  if (place.status === 'finding') {
    return (
      <View style={styles.placeHero}>
        <View style={styles.pinWrap}>
          <Pulse />
          <View style={styles.pin}>
            <MapPin size={32} color={colors.white} strokeWidth={1.5} />
          </View>
        </View>
        <Text style={type.heading}>Finding your location…</Text>
        <Text style={[type.small, styles.center]}>This takes a few seconds, longer indoors.</Text>
      </View>
    );
  }
  if (place.status === 'found') {
    return (
      <>
        <View style={styles.placeHero}>
          <View style={[styles.pin, styles.pinFound]}>
            <MapPin size={32} color={colors.white} strokeWidth={1.5} />
          </View>
          <Text style={type.heading}>Location found</Text>
        </View>
        <Card style={styles.placeCard}>
          <MapPin size={22} color={colors.primary} strokeWidth={1.5} />
          <View style={styles.flex}>
            <Text style={styles.placeLabel}>{place.label ?? 'Location captured'}</Text>
            <Text style={type.small}>Accurate to about {Math.round(place.position.accuracy)} m</Text>
          </View>
        </Card>
      </>
    );
  }
  const denied = place.status === 'failed' && place.reason === 'denied';
  return (
    <View style={styles.placeHero}>
      <View style={[styles.pin, styles.pinOff]}>
        <MapPinOff size={32} color={colors.error} strokeWidth={1.5} />
      </View>
      <Text style={type.heading}>{denied ? 'Location is off' : "Couldn't get your location"}</Text>
      <Text style={[type.body, styles.muted, styles.center]}>
        {denied
          ? 'Turn on location for Modusys in Settings so your check-in records where you are, or continue without it.'
          : 'Check that location is on and try again, or continue without it.'}
      </Text>
    </View>
  );
}

/** A 3:4 box with corner brackets: the photo once taken, otherwise the live camera over a face hint. */
function FaceFrame({ photo, live }: { photo: string | null; live?: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const w = Math.min(280, Math.round(width * 0.68));
  const h = Math.round((w * 4) / 3);
  return (
    <View style={[styles.frame, { width: w, height: h }]}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.framePhoto} accessibilityLabel="Your selfie" />
      ) : (
        <View style={styles.frameEmpty}>
          <ScanFace size={72} color={colors.primary} strokeWidth={1} />
          {live}
        </View>
      )}
      <View style={[styles.corner, styles.tl]} />
      <View style={[styles.corner, styles.tr]} />
      <View style={[styles.corner, styles.bl]} />
      <View style={[styles.corner, styles.br]} />
    </View>
  );
}

function placeText(place: Place): string {
  if (place.status === 'found') return place.label ?? 'Location captured';
  return 'No location';
}

const PIN = 80;
const CORNER = 32;

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  body: { flexGrow: 1, padding: space.screen, gap: space.screen },
  footer: { paddingHorizontal: space.screen, paddingTop: space.md, paddingBottom: space.lg, gap: space.xs },
  muted: { color: colors.textSecondary },
  center: { textAlign: 'center' },
  progress: { gap: space.sm },
  progressBars: { flexDirection: 'row', gap: space.xs },
  progressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressOn: { backgroundColor: colors.primary },
  placeHero: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  pinWrap: { width: PIN * 1.6, height: PIN * 1.6, alignItems: 'center', justifyContent: 'center' },
  pulse: {
    position: 'absolute',
    width: PIN * 1.4,
    height: PIN * 1.4,
    borderRadius: (PIN * 1.4) / 2,
    backgroundColor: colors.primarySoft,
  },
  pin: {
    width: PIN,
    height: PIN,
    borderRadius: PIN / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinFound: { backgroundColor: colors.success },
  pinOff: { backgroundColor: colors.errorTint },
  placeCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  placeLabel: { ...type.body, fontWeight: '600' },
  frame: { alignSelf: 'center', marginTop: space.sm },
  framePhoto: { flex: 1, borderRadius: radius.lg, backgroundColor: colors.greyTint },
  frameEmpty: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // clips the live camera to the rounded frame
  },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.primary },
  tl: { top: -6, left: -6, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: radius.lg },
  tr: { top: -6, right: -6, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: radius.lg },
  bl: { bottom: -6, left: -6, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: radius.lg },
  br: { bottom: -6, right: -6, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: radius.lg },
  confirm: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  thumb: { width: 84, height: 112, borderRadius: radius.md, backgroundColor: colors.greyTint },
  confirmText: { flex: 1, gap: space.xs },
  confirmTime: { ...type.kpi, fontSize: 26 },
  inlinePlace: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  success: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingVertical: space.xxl },
  successRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.successTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  successTitle: { ...type.title, fontSize: 24, textAlign: 'center' },
});
