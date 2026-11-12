'use client';

import { MoonIcon, SunIcon } from './icons';
import type { Theme } from '@/lib/useTheme';

export default function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const dark = theme === 'dark';
  return (
    <button type="button" className="tool" onClick={onToggle} aria-pressed={dark} aria-label={`Dark theme ${dark ? 'on' : 'off'}`}>
      {dark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
      <span className="tool-label">{dark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
