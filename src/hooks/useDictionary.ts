import { useState, useEffect } from 'react';
import { db } from '../db/dexie';

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string }[];
    synonyms: string[];
  }[];
}

export function useDictionary(word: string) {
  const [data, setData] = useState<DictionaryEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!word) {
      setData(null);
      return;
    }
    
    const fetchDef = async () => {
      setLoading(true);
      setError(null);
      
      const cleanWord = word.trim().toLowerCase();
      
      // Check IndexedDB cache first
      try {
        const cached = await db.dictionary.get(cleanWord);
        if (cached && Date.now() - cached.cachedAt.getTime() < 7 * 24 * 60 * 60 * 1000) {
          setData(cached.data as DictionaryEntry);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Failed to read from dictionary cache', e);
      }

      try {
        const res = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`
        );
        if (!res.ok) throw new Error('Word not found');
        const json = await res.json();
        
        // The API returns an array, pick the first result
        const entry = Array.isArray(json) ? json[0] : json;
        
        // Cache in IndexedDB
        await db.dictionary.put({ word: cleanWord, data: entry, cachedAt: new Date() });
        setData(entry);
      } catch (e) {
        setError('Definition not found');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDef();
  }, [word]);

  return { data, loading, error };
}
