// Check in / Check out in three steps, like the web: location, selfie, confirm.
// GPS is best-effort (the server accepts a check-in without it); the selfie is
// required, and taking and sending it is the consent, exactly as on the web.
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { CircleCheck, MapPin, MapPinOff } from 'lucide-react-native';
import { checkIn, checkOut, placeName, uploadSelfie, type Side } from '../../api/attendance';
import { Button, Card, Notice, Screen, TextField } from '../../components/ui';
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

const SELFIE_ERRORS: Record<Exclude<SelfieResult, { ok: true }>['reason'], string | null> = {
  cancelled: null,
  'no-camera': "This device has no camera. Use a phone to check in.",
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

  const capture = async (fromLibrary = false) => {
    setPhotoError(null);
    const res = fromLibrary ? await pickTestPhoto() : await takeSelfie();
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
      <Screen edges={['left', 'right', 'bottom']}>
        <View style={styles.success}>
          <CircleCheck size={88} color={colors.success} strokeWidth={1.5} />
          <Text style={[type.title, styles.center]}>
            {side === 'checkIn' ? 'Checked in' : 'Checked out'} at {formatTime(doneAt)}
          </Text>
          <Text style={[type.body, styles.muted, styles.center]}>
            It shows on the web's attendance pages right away.
          </Text>
        </View>
        <Button label="Done" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Text style={type.label}>
        Step {step === 'location' ? 1 : step === 'selfie' ? 2 : 3} of 3
      </Text>

      {step === 'location' ? (
        <>
          <Card>
            <PlaceView place={place} />
          </Card>
          {place.status === 'found' ? <Button label="Continue" onPress={() => setStep('selfie')} /> : null}
          {place.status === 'failed' ? (
            <>
              {place.reason === 'denied' ? (
                <Button label="Open Settings" onPress={() => Linking.openSettings()} />
              ) : (
                <Button label="Try again" onPress={findPlace} />
              )}
              <Button
                label={`${verb} without location`}
                variant="secondary"
                onPress={() => {
                  setPlace({ status: 'skipped' });
                  setStep('selfie');
                }}
              />
            </>
          ) : null}
        </>
      ) : null}

      {step === 'selfie' ? (
        <>
          <Card style={styles.center}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.preview} accessibilityLabel="Your selfie" />
            ) : (
              <Text style={[type.body, styles.center]}>
                Take a selfie with the front camera.{'\n'}Make sure your face is clearly visible.
              </Text>
            )}
          </Card>
          {photoError ? <Notice text={photoError.text} /> : null}
          {photoError?.settings ? <Button label="Open Settings" onPress={() => Linking.openSettings()} /> : null}
          {photoError?.noCamera && __DEV__ ? (
            <Button label="Use a saved photo (simulator only)" variant="secondary" onPress={() => capture(true)} />
          ) : null}
          {photo ? (
            <>
              <Button label="Use photo" onPress={() => setStep('confirm')} />
              <Button label="Retake" variant="secondary" onPress={() => capture()} />
            </>
          ) : (
            <Button label="Open camera" onPress={() => capture()} />
          )}
        </>
      ) : null}

      {step === 'confirm' && photo ? (
        <>
          <Card>
            <View style={styles.confirm}>
              <Image source={{ uri: photo }} style={styles.thumb} accessibilityLabel="Your selfie" />
              <View style={styles.confirmText}>
                <Text style={type.heading}>{formatTime(new Date())}</Text>
                <Text style={[type.body, styles.muted]}>{placeText(place)}</Text>
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
          <Button label={verb} onPress={send} loading={sending} />
          <Button label="Retake selfie" variant="text" onPress={() => setStep('selfie')} disabled={sending} />
        </>
      ) : null}
    </Screen>
  );
}

function placeText(place: Place): string {
  if (place.status === 'found') return place.label ?? 'Location captured';
  return 'No location';
}

function PlaceView({ place }: { place: Place }) {
  if (place.status === 'finding') {
    return (
      <View style={styles.place}>
        <MapPin size={28} color={colors.primary} strokeWidth={1.5} />
        <Text style={type.body}>Getting your location…</Text>
      </View>
    );
  }
  if (place.status === 'found') {
    return (
      <View style={styles.place}>
        <MapPin size={28} color={colors.success} strokeWidth={1.5} />
        <View style={styles.placeText}>
          <Text style={type.heading}>{place.label ?? 'Location found'}</Text>
          <Text style={type.small}>Accurate to about {Math.round(place.position.accuracy)} m</Text>
        </View>
      </View>
    );
  }
  const text =
    place.status === 'failed' && place.reason === 'denied'
      ? 'Location access is off for Modusys. Turn it on in Settings so your check-in records where you are, or continue without it.'
      : "Couldn't get your location. Check that location is on and try again, or continue without it.";
  return (
    <View style={styles.place}>
      <MapPinOff size={28} color={colors.error} strokeWidth={1.5} />
      <Text style={[type.body, styles.placeText]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textSecondary },
  center: { alignItems: 'center', textAlign: 'center' },
  place: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  placeText: { flex: 1, gap: 2 },
  preview: { width: 240, height: 320, borderRadius: radius.md, backgroundColor: colors.greyTint },
  confirm: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  thumb: { width: 72, height: 96, borderRadius: radius.sm, backgroundColor: colors.greyTint },
  confirmText: { flex: 1, gap: space.xs },
  success: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
});
