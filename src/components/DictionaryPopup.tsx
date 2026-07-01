import { motion } from 'framer-motion';
import { X, Volume2 } from 'lucide-react';
import { useReaderStore } from '../store/useReaderStore';
import { useDictionary } from '../hooks/useDictionary';

export default function DictionaryPopup() {
  const { selectedWord, closeDictionary } = useReaderStore();
  const { data, loading, error } = useDictionary(selectedWord);

  const playAudio = () => {
    const audioUrl = data?.phonetics?.find((p: any) => p.audio)?.audio;
    if (audioUrl) {
      new Audio(audioUrl).play().catch(e => console.warn('Failed to play audio', e));
    }
  };

  return (
    <motion.div
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 36 }}
      onClick={(e) => e.stopPropagation()} // Prevent closing HUD when clicking dictionary
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        borderRadius: '24px 24px 0 0',
        padding: 24,
        maxHeight: '50vh',
        overflowY: 'auto',
        zIndex: 100,
        boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Merriweather', color: 'var(--card-fg)', fontSize: 20 }}>
            {selectedWord}
          </h2>
          {data?.phonetic && (
            <p style={{ margin: 0, color: 'var(--muted-fg)', fontSize: 13 }}>{data.phonetic}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {data?.phonetics?.some(p => p.audio) && (
            <button onClick={playAudio} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
              <Volume2 size={20} color="var(--primary)" />
            </button>
          )}
          <button onClick={closeDictionary} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
            <X size={20} color="var(--muted-fg)" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && <p style={{ color: 'var(--muted-fg)', fontSize: 14 }}>Looking up "{selectedWord}"...</p>}
      {error && <p style={{ color: 'var(--muted-fg)', fontSize: 14 }}>{error}</p>}
      
      {data && data.meanings && data.meanings.slice(0, 3).map((meaning, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          <span style={{
            background: 'var(--secondary)',
            color: 'var(--fg)',
            padding: '2px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontFamily: 'Inter',
            fontWeight: 600,
          }}>
            {meaning.partOfSpeech}
          </span>
          {meaning.definitions.slice(0, 2).map((def, j) => (
            <div key={j} style={{ marginTop: 8 }}>
              <p style={{ margin: 0, color: 'var(--card-fg)', fontSize: 14, lineHeight: 1.5 }}>
                {def.definition}
              </p>
              {def.example && (
                <p style={{ margin: '4px 0 0', color: 'var(--muted-fg)', fontSize: 13, fontStyle: 'italic' }}>
                  "{def.example}"
                </p>
              )}
            </div>
          ))}
          {meaning.synonyms && meaning.synonyms.length > 0 && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted-fg)' }}>
              Synonyms: {meaning.synonyms.slice(0, 4).join(', ')}
            </p>
          )}
        </div>
      ))}
    </motion.div>
  );
}
