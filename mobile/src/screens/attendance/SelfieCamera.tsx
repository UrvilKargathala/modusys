// The live selfie camera (M6d): the front camera's picture inside the check-in face frame, instead of the phone's own
// camera app. Takes a 480×640 JPEG like before (the server's limit is 500 KB). When the phone has no front camera or
// camera access is refused, the parent falls back to the phone's own camera / Settings, as before.
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, CommonResolutions, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import type { SelfieResult } from '../../lib/device';

export type SelfieCameraHandle = { capture: () => Promise<SelfieResult> };
export type SelfieCameraState = 'starting' | 'ready' | 'no-camera' | 'denied';

const W = 480;
const H = 640;

export const SelfieCamera = forwardRef<SelfieCameraHandle, { active: boolean; onState: (s: SelfieCameraState) => void }>(
  function LiveSelfie({ active, onState }, ref) {
    const permission = useCameraPermission();
    const device = useCameraDevice('front');
    const photoOutput = usePhotoOutput({ targetResolution: CommonResolutions.VGA_4_3, containerFormat: 'jpeg', quality: 0.8 });

    // Ask once (the permission object changes on every render; a second request leaves a dangling native promise).
    const asked = useRef(false);
    const { hasPermission, canRequestPermission, requestPermission } = permission;
    useEffect(() => {
      if (asked.current || hasPermission || !canRequestPermission) return;
      asked.current = true;
      requestPermission().catch(() => {});
    }, [hasPermission, canRequestPermission, requestPermission]);

    const state: SelfieCameraState = !hasPermission
      ? canRequestPermission ? 'starting' : 'denied'
      : device ? 'ready' : 'no-camera';
    useEffect(() => onState(state), [state, onState]);

    useImperativeHandle(ref, () => ({
      capture: async () => {
        try {
          const photo = await photoOutput.capturePhoto({ flashMode: 'off' }, {});
          const image = await photo.toImageAsync(); // upright and mirrored as the preview showed it
          photo.dispose();
          // Fit inside 480×640 (portrait), as the phone camera's maxWidth / maxHeight did.
          const scale = Math.min(1, W / image.width, H / image.height);
          const small = scale < 1 ? await image.resizeAsync(Math.round(image.width * scale), Math.round(image.height * scale)) : image;
          const path = await small.saveToTemporaryFileAsync('jpg', 70);
          return { ok: true, photo: { uri: path.startsWith('file://') ? path : `file://${path}`, type: 'image/jpeg', width: small.width, height: small.height } };
        } catch {
          return { ok: false, reason: 'failed' };
        }
      },
    }), [photoOutput]);

    if (state !== 'ready' || !device) return <View style={styles.fill} />;
    return <Camera style={styles.fill} device={device} isActive={active} outputs={[photoOutput]} />;
  },
);

const styles = StyleSheet.create({ fill: StyleSheet.absoluteFill });
