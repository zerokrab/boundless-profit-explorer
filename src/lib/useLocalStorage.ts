/**
 * useLocalStorage — useState with automatic persistence to localStorage.
 *
 * - Reads the stored value on first render (falls back to defaultValue if
 *   missing or unparseable).
 * - Writes to localStorage on every change.
 * - Storage key collisions are scoped to this app via the "bpe:" prefix.
 */
import { useState, useEffect } from 'react';

const PREFIX = 'bpe:';

export function useLocalStorage<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const storageKey = PREFIX + key;

  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(storageKey);
      return item !== null ? (JSON.parse(item) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Ignore write errors (private browsing quota, etc.)
    }
  }, [storageKey, value]);

  return [value, setValue];
}
