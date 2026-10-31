import { useCallback, useEffect, useState } from 'react';

type FullscreenDocument = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };

/**
 * Focus mode for the exam and practice screens: also takes the browser itself fullscreen
 * (hides tabs/address bar). Leaving fullscreen via Esc or browser UI drops focus mode too.
 */
export function useFocusMode(): [boolean, () => void] {
  const [isFocusMode, setIsFocusMode] = useState(false);

  const toggleFocusMode = useCallback(() => {
    const doc = document as FullscreenDocument;
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    const isFullscreen = !!(document.fullscreenElement || doc.webkitFullscreenElement);
    if (!isFocusMode) {
      setIsFocusMode(true);
      if (!isFullscreen) {
        const request = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
        Promise.resolve(request?.()).catch(() => undefined);
      }
    } else {
      setIsFocusMode(false);
      if (isFullscreen) {
        const exit = document.exitFullscreen?.bind(document) ?? doc.webkitExitFullscreen?.bind(doc);
        Promise.resolve(exit?.()).catch(() => undefined);
      }
    }
  }, [isFocusMode]);

  useEffect(() => {
    const doc = document as FullscreenDocument;
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && !doc.webkitFullscreenElement) setIsFocusMode(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      // Don't leave the browser stuck fullscreen after navigating away from the exam.
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
      else if (doc.webkitFullscreenElement) doc.webkitExitFullscreen?.().catch(() => undefined);
    };
  }, []);

  return [isFocusMode, toggleFocusMode];
}
