import React from 'react';
import { useApp } from '../context/AppContext';
import '../styles/components/AgentOverlay.css';   // .agent-overlay (fixed full-screen popup)
import '../styles/components/TripOverlay.css';

export default function TripOverlay({ onRepeatPin }) {
  const { state } = useApp();
  const visible = state.appState === 'trip_live';

  if (!visible) return null;

  const pinDigits = state.pin ? state.pin.split('') : [];
  const hasPin = pinDigits.length > 0;
  // 3 stages: tìm tài xế -> đã có tài xế (đang đến) -> đã đến (hiện PIN)
  const title = !state.driver
    ? '🔎 Đang tìm tài xế…'
    : (hasPin ? '🚗 Tài xế đã đến!' : '🚗 Đã có tài xế, đang đến…');
  const sub = !state.driver
    ? 'Vui lòng chờ…'
    : (hasPin ? 'Đọc mã PIN cho tài xế để xác minh' : 'Tài xế đang trên đường đến đón bạn');

  // Blind rider: TAP ANYWHERE on the screen to hear the PIN read again (no button
  // to hunt for). While still searching / en route, taps are ignored so a stray
  // touch can't cancel the trip.
  const handleTap = () => { if (hasPin) onRepeatPin?.(); };

  return (
    <div
      className="agent-overlay"
      role="dialog"
      aria-modal="true"
      onClick={handleTap}
      style={hasPin ? { cursor: 'pointer' } : undefined}
      aria-label={hasPin ? 'Chạm vào màn hình để nghe lại mã PIN' : undefined}
    >
      <div className="agent-box">
        {!state.driver && <div className="agent-spinner" aria-hidden="true" />}
        <div className="agent-title">{title}</div>
        {state.driver && (
          <div className="trip-driver" role="status" aria-live="polite">
            {state.driver.name} — {state.driver.plate}
          </div>
        )}
        {hasPin && (
          <div className="pin-row" role="status" aria-live="polite">
            {pinDigits.map((d, i) => (
              <span key={i} className="pin-digit">{d}</span>
            ))}
          </div>
        )}
        <div className="agent-result" role="status" aria-live="assertive">{sub}</div>
        {hasPin && (
          <div className="agent-result" aria-hidden="true" style={{ opacity: 0.7, fontSize: '0.9em', marginTop: 8 }}>
            👆 Chạm vào màn hình để nghe lại mã PIN
          </div>
        )}
      </div>
    </div>
  );
}
