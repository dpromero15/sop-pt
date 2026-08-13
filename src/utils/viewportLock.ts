import { useEffect } from 'react';

export const DEFAULT_VIEWPORT =
  'width=device-width, initial-scale=1.0, viewport-fit=cover';

export const LOGGER_COCKPIT_VIEWPORT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

export const LOGGER_COCKPIT_CLASS = 'logger-cockpit';

function viewportMeta(doc: Document): HTMLMetaElement {
  let meta = doc.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = doc.createElement('meta');
    meta.setAttribute('name', 'viewport');
    doc.head.appendChild(meta);
  }
  return meta as HTMLMetaElement;
}

export function lockLoggerCockpit(doc: Document = document): void {
  doc.documentElement.classList.add(LOGGER_COCKPIT_CLASS);
  viewportMeta(doc).setAttribute('content', LOGGER_COCKPIT_VIEWPORT);
}

export function unlockLoggerCockpit(doc: Document = document): void {
  doc.documentElement.classList.remove(LOGGER_COCKPIT_CLASS);
  viewportMeta(doc).setAttribute('content', DEFAULT_VIEWPORT);
}

/** Freeze pinch/double-tap zoom and body rubber-band while the session logger is open. */
export function useLoggerCockpit(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    lockLoggerCockpit();
    const blockPinch = (event: Event) => {
      event.preventDefault();
    };
    document.addEventListener('gesturestart', blockPinch, { passive: false });
    document.addEventListener('gesturechange', blockPinch, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', blockPinch);
      document.removeEventListener('gesturechange', blockPinch);
      unlockLoggerCockpit();
    };
  }, [active]);
}
