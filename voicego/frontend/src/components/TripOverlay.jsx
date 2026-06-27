import React from 'react';
import { useApp } from '../context/AppContext';
import '../styles/components/TripOverlay.css';

export default function TripOverlay({ onDismiss }) {
  const { state } = useApp();
  const visible = state.appState === 'trip_live';

  if (!visible) return null;

  const pinDigits = state.pin ? state.pin.split('') : [];

  return (
    <div className="agent-overlay" role="dialog" aria-modal="true" onClick={onDismiss}>
      <div className="agent-box" onClick={(e) => e.stopPropagation()}>
        {!state.driver && <div className="agent-spinner" aria-hidden="true" />}
        <div className="agent-title">
          {state.driver ? '🚗 Tài xế đã đến!' : '🔎 Đang tìm tài xế…'}
        </div>
        {state.driver && (
          <div className="trip-driver" role="status" aria-live="polite">
            {state.driver.name} — {state.driver.plate}
          </div>
        )}
        {pinDigits.length > 0 && (
          <div className="pin-row" role="status" aria-live="polite">
            {pinDigits.map((d, i) => (
              <span key={i} className="pin-digit">{d}</span>
            ))}
          </div>
        )}
        <div className="agent-result" role="status" aria-live="assertive">
          {state.pin ? 'Đọc mã PIN cho tài xế để xác minh' : 'Vui lòng chờ…'}
        </div>
      </div>
    </div>
  );
}
