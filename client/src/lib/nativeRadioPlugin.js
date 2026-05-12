import { registerPlugin } from '@capacitor/core';

/**
 * Bridge to RadioPlugin.java (Android Foreground Service).
 * On web/iOS the no-op stubs are used — HTML5 audio handles playback there.
 */
export const RadioPlayer = registerPlugin('RadioPlayer', {
  web: {
    start:     () => Promise.resolve(),
    stop:      () => Promise.resolve(),
    setVolume: () => Promise.resolve(),
  },
});
