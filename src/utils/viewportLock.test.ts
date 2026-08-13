import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_VIEWPORT,
  LOGGER_COCKPIT_CLASS,
  LOGGER_COCKPIT_VIEWPORT,
  lockLoggerCockpit,
  unlockLoggerCockpit,
} from './viewportLock';

function fakeDocument() {
  const classes = new Set<string>();
  const meta = {
    content: DEFAULT_VIEWPORT,
    getAttribute(name: string) {
      return name === 'content' ? this.content : null;
    },
    setAttribute(name: string, value: string) {
      if (name === 'content') this.content = value;
    },
  };
  return {
    meta,
    documentElement: {
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
        contains: (c: string) => classes.has(c),
      },
    },
    head: { appendChild: vi.fn() },
    querySelector: (sel: string) => (sel === 'meta[name="viewport"]' ? meta : null),
    createElement: vi.fn(),
  } as unknown as Document & { meta: { content: string } };
}

describe('viewportLock', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('locks zoom and tags the document as cockpit', () => {
    const doc = fakeDocument();
    lockLoggerCockpit(doc);
    expect(doc.documentElement.classList.contains(LOGGER_COCKPIT_CLASS)).toBe(
      true,
    );
    expect(doc.meta.content).toBe(LOGGER_COCKPIT_VIEWPORT);
    expect(LOGGER_COCKPIT_VIEWPORT).toContain('user-scalable=no');
    expect(LOGGER_COCKPIT_VIEWPORT).toContain('maximum-scale=1');
  });

  it('restores the default viewport on unlock', () => {
    const doc = fakeDocument();
    lockLoggerCockpit(doc);
    unlockLoggerCockpit(doc);
    expect(doc.documentElement.classList.contains(LOGGER_COCKPIT_CLASS)).toBe(
      false,
    );
    expect(doc.meta.content).toBe(DEFAULT_VIEWPORT);
  });
});
