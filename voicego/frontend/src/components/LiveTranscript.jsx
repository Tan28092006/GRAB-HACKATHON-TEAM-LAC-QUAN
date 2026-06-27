import React from 'react';
import { useApp } from '../context/AppContext';
import '../styles/components/LiveTranscript.css';

export default function LiveTranscript() {
  const { state } = useApp();
  if (!state.transcript) return null;
  return (
    <div className="live-transcript" aria-hidden="true">
      "{state.transcript}"
    </div>
  );
}
