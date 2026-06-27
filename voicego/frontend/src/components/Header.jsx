import React from 'react';
import { useApp } from '../context/AppContext';
import '../styles/components/Header.css';

export default function Header() {
  const { state } = useApp();
  return (
    <header className="voice-header">
      <div className="voice-title">🎙️ VoiceGo</div>
      <div className="voice-meta">
        <span className={`backend-dot ${state.backendOnline ? 'online' : 'offline'}`}>
          {state.backendOnline ? '⚡ Trực tuyến' : '⚡ Cục bộ'}
        </span>
      </div>
    </header>
  );
}
