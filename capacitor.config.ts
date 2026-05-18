import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alp.eclipse',
  appName: 'Eclipse',
  webDir: 'dist',
  server: {
    url: 'https://ais-pre-w45lc4cbp2gfw5huofubmk-718335418463.europe-west2.run.app',
    cleartext: true
  }
};

export default config;
