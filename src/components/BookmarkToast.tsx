import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  message: string;
  isVisible: boolean;
}

export default function BookmarkToast({ message, isVisible }: Props) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          style={{
            position: 'fixed',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--primary)',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
            zIndex: 110,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            pointerEvents: 'none',
            fontFamily: 'Inter',
          }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
