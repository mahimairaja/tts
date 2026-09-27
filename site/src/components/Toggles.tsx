import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';

// The theme switch: Radix ToggleGroup, drawn as a shadcn-style segmented control.

// Theme: the choice lives in localStorage['tts-theme'] ('light' | 'dark' | 'auto'; dark
// when unset). Layout.astro applies it before paint and exposes window.__applyTheme.
declare global {
  interface Window {
    __applyTheme?: () => void;
  }
}
type Theme = 'light' | 'dark' | 'auto';
const KEY = 'tts-theme';
const readTheme = (): Theme => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'auto' ? v : 'dark';
  } catch {
    return 'dark';
  }
};
const subscribe = (cb: () => void) => {
  window.addEventListener('tts-theme', cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener('tts-theme', cb);
    window.removeEventListener('storage', cb);
  };
};
const applyTheme = () => {
  window.__applyTheme?.();
  window.dispatchEvent(new Event('tts-theme'));
};

export function ThemeToggle({ label }: { label: string }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'dark' as Theme);
  useEffect(() => {
    if (theme !== 'auto') return;
    const m = matchMedia('(prefers-color-scheme: light)');
    m.addEventListener('change', applyTheme);
    return () => m.removeEventListener('change', applyTheme);
  }, [theme]);
  const items = [
    { value: 'light', label: 'Light', Icon: Sun },
    { value: 'dark', label: 'Dark', Icon: Moon },
    { value: 'auto', label: 'Auto', Icon: Monitor },
  ] as const;
  return (
    <ToggleGroup.Root
      type="single"
      value={theme}
      aria-label={label}
      className="seg"
      onValueChange={(v) => {
        if (!v) return;
        try {
          localStorage.setItem(KEY, v);
        } catch {
          // storage blocked: nothing persists, the page keeps its theme
        }
        applyTheme();
      }}
    >
      {items.map(({ value, label, Icon }) => (
        <ToggleGroup.Item key={value} value={value} aria-label={label} title={label} className="seg__item seg__item--icon">
          <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
