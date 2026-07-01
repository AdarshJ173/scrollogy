import { useReaderStore, type Theme } from '../store/useReaderStore';
import { haptic } from '../engine/HapticEngine';

export default function ThemePicker() {
  const { theme, setTheme } = useReaderStore();

  const themes: { id: Theme; name: string; color: string }[] = [
    { id: 'light', name: 'Light', color: '#F9F7F2' },
    { id: 'sepia', name: 'Sepia', color: '#F4EBD9' },
    { id: 'dark', name: 'Dark', color: '#2A2820' },
    { id: 'true-black', name: 'Black', color: '#000000' },
  ];

  return (
    <div className="flex gap-3 justify-center items-center p-2">
      {themes.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            setTheme(t.id);
            haptic.themeChange();
          }}
          style={{
            background: t.color,
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: theme === t.id ? '2px solid var(--primary)' : '1px solid var(--border)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            cursor: 'pointer',
          }}
          title={t.name}
        />
      ))}
    </div>
  );
}
