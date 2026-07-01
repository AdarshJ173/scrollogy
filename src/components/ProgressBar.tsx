import { motion } from 'framer-motion';

export default function ProgressBar({ progress }: { progress: number }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      background: 'var(--border)',
      zIndex: 50,
    }}>
      <motion.div
        style={{
          height: '100%',
          background: 'var(--primary)',
          transformOrigin: 'left',
        }}
        animate={{ scaleX: Math.min(1, Math.max(0, progress / 100)) }}
        transition={{ type: 'spring', stiffness: 200, damping: 30 }}
      />
    </div>
  );
}
