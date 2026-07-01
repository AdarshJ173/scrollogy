import { useReaderStore } from '../store/useReaderStore';
import { haptic } from '../engine/HapticEngine';

export default function FontSizeSlider() {
  const { fontSize, setFontSize } = useReaderStore();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const size = parseInt(e.target.value, 10);
    setFontSize(size);
    haptic.fontSizeChange();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: '240px' }}>
      <span style={{ fontSize: 13, color: 'var(--muted-fg)', fontFamily: 'Inter' }}>A</span>
      <input
        type="range"
        min="14"
        max="28"
        value={fontSize}
        onChange={handleChange}
        style={{
          flex: 1,
          accentColor: 'var(--primary)',
          cursor: 'pointer',
        }}
      />
      <span style={{ fontSize: 18, color: 'var(--fg)', fontFamily: 'Inter', fontWeight: 600 }}>A</span>
    </div>
  );
}
