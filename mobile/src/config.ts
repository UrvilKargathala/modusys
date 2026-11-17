// Where the app finds the backend. Debug builds use the local web app
// (`npm run dev` in ~/modusys, port 3001), release builds the live site.
// For a real phone, put the Mac's Wi-Fi address in src/config.local.ts
// (git-ignored), e.g. `export const API_URL_OVERRIDE = 'http://192.168.1.23:3001';`

let override: string | undefined;
try {
  override = require('./config.local').API_URL_OVERRIDE;
} catch {
  override = undefined;
}

export const API_URL: string = override ?? (__DEV__ ? 'http://localhost:3001' : 'https://modusys.co.in');

/** Shown at the foot of More. Keep in step with versionName/versionCode (android/app/build.gradle)
 *  and MARKETING_VERSION/CURRENT_PROJECT_VERSION (ios project). */
export const APP_VERSION = '1.0 (build 1)';
