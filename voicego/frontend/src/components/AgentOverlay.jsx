import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import '../styles/components/AgentOverlay.css';

export default function AgentOverlay({ onDismiss }) {
  const { state } = useApp();
  const logRef = useRef(null);
  const visible = state.appState === 'booking';

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [state.agentLog]);

  if (!visible) return null;

  return (
    <div className="agent-overlay" role="dialog" aria-modal="true" onClick={onDismiss}>
      <div className="agent-box" onClick={(e) => e.stopPropagation()}>
        <div className="agent-spinner" aria-hidden="true" />
        <div className="agent-title">🤖 AI Agent đang đặt xe…</div>
        <div className="agent-log" ref={logRef} aria-hidden="true">
          {state.agentLog.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
        {state.agentResult && (
          <div className="agent-result" role="status" aria-live="assertive">
            {state.agentResult}
          </div>
        )}
      </div>
    </div>
  );
}
