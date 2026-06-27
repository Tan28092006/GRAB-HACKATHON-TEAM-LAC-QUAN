import React from 'react';
import { useApp } from '../context/AppContext';
import '../styles/components/TripCard.css';

export default function TripCard() {
  const { state } = useApp();
  return (
    <div className="trip-card">
      <div className="trip-row">
        <span className="trip-dot red" />
        <span className="trip-label">Điểm đi</span>
        <span className="trip-value">{state.origin.name}</span>
      </div>
      <div className="trip-row">
        <span className="trip-dot green" />
        <span className="trip-label">Điểm đến</span>
        <span className={`trip-value ${!state.destination ? 'muted' : ''}`}>
          {state.destination ? state.destination.name : 'Chưa có — hãy nói điểm đến'}
        </span>
      </div>
    </div>
  );
}
