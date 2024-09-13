import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kirishogi',
  appName: '霧将棋',
  webDir: 'out',
  bundledWebRuntime: false,
  server: {
    url: 'https://kirishogi.com',
    cleartext: true
  },
};

export default config;
