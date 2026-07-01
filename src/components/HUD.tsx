import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Moon, Sun } from 'lucide-react';
import { useReaderStore } from '../store/useReaderStore';
import { haptic } from '../engine/HapticEngine';
import { useNavigate } from 'react-router-dom';

export default function HUD({ progress }: { progress: number }) {
  const { isHUDVisible, toggleHUD, theme, setTheme, fontSize, setFontSize } = useReaderStore();
  const navigate = useNavigate();

  // Auto-hide after 3 seconds when HUD becomes visible
  useEffect(() => {
    if (!isHUDVisible) return;
    const t = setTimeout(() => {
      toggleHUD();
    }, 4000); // 4 seconds to be slightly generous for user interactions
    return () => clearTimeout(t);
  }, [isHUDVisible, toggleHUD]);

  // Prevent event bubbling on hud content click
  const stopProp = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <AnimatePresence>
      {isHUDVisible && (
        <>
          {/* Top bar */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            onClick={stopProp}
            style={{
              position: 'fixed',
              top: 8,
              left: 16,
              right: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              zIndex: 60,
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
          >
            <button
              onClick={() => { 
                haptic.hudToggle(); 
                navigate('/library'); 
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <ChevronLeft size={20} color="var(--fg)" />
            </button>
            <span style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--muted-fg)' }}>
              {Math.round(progress)}% complete
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => { 
                  setTheme(theme === 'dark' ? 'light' : 'dark'); 
                  haptic.themeChange(); 
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                {theme === 'dark' 
                  ? <Sun size={18} color="var(--fg)" /> 
                  : <Moon size={18} color="var(--fg)" />
                }
              </button>
            </div>
          </motion.div>

          {/* Bottom bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={stopProp}
            style={{
              position: 'fixed',
              bottom: 24,
              left: 16,
              right: 16,
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              padding: '16px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              zIndex: 60,
              boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
            }}
          >
            {/* Font size controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => { 
                  setFontSize(Math.max(14, fontSize - 1)); 
                  haptic.fontSizeChange(); 
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter', fontSize: 16, color: 'var(--fg)', padding: '0 8px' }}
              >
                A-
              </button>
              <span style={{ fontSize: 14, color: 'var(--muted-fg)', fontFamily: 'Inter' }}>{fontSize}px</span>
              <button
                onClick={() => { 
                  setFontSize(Math.min(28, fontSize + 1)); 
                  haptic.fontSizeChange(); 
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter', fontSize: 22, color: 'var(--fg)', padding: '0 8px' }}
              >
                A+
              </button>
            </div>

            {/* Theme selector */}
            <div style={{ display: 'flex', gap: 8 }}>
              {(['light', 'sepia', 'dark', 'true-black'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { 
                    setTheme(t); 
                    haptic.themeChange(); 
                  }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: theme === t ? '2px solid var(--primary)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    background: t === 'light' ? '#F9F7F2' : t === 'sepia' ? '#F4EBD9' : t === 'dark' ? '#2A2820' : '#000',
                  }}
                  title={t}
                />
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
