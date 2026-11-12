'use client';

import { useTheme } from '@/lib/useTheme';
import ThemeToggle from './ThemeToggle';

/* Self-contained toggle for server-rendered pages such as the landing page. */
export default function ThemeSwitch() {
  const { theme, toggle } = useTheme();
  return <ThemeToggle theme={theme} onToggle={toggle} />;
}
