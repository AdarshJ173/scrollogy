import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useReaderStore } from './store/useReaderStore';
import Library from './screens/Library';
import Reader from './screens/Reader';
import './styles/globals.css';
import './styles/reader.css';

export default function App() {
  const { theme, fontSize } = useReaderStore();

  // Apply theme and font size on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.setProperty('--reader-font-size', `${fontSize}px`);
  }, [theme, fontSize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/library" replace />} />
        <Route path="/library" element={<Library />} />
        <Route path="/reader" element={<Reader />} />
      </Routes>
    </BrowserRouter>
  );
}
