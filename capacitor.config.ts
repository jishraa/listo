import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.listo.lists',
  appName: 'Listo',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    backgroundColor: '#04080f',
  },
  android: {
    backgroundColor: '#04080f',
  },
}

export default config
