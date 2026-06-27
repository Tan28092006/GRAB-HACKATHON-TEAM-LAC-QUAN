import React from 'react';
import '../styles/components/RecordButton.css';

export default function RecordButton({ onPress, onRelease, recording }) {
  return (
    <button
      className={`record-btn ${recording ? 'recording' : ''}`}
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onTouchStart={onPress}
      onTouchEnd={onRelease}
      aria-label="Chạm để nói điểm đến"
    >
      <span className="mic-icon" aria-hidden="true">🎙️</span>
      <span className="record-label">{recording ? 'Đang nghe…' : 'Chạm để nói'}</span>
    </button>
  );
}
