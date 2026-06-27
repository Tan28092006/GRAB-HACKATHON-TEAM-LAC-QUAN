import React from 'react';
import { AppProvider } from './context/AppContext';
import Header from './components/Header';
import MapView from './components/MapView';
import TripCard from './components/TripCard';
import GestureZone from './components/GestureZone';
import RecordButton from './components/RecordButton';
import AgentOverlay from './components/AgentOverlay';
import TripOverlay from './components/TripOverlay';
import LoginPage from './components/LoginPage';
import DriverView from './components/DriverView';
import useVoiceApp from './hooks/useVoiceApp';
import { useApp } from './context/AppContext';

function AppContent() {
  const { state, startListening, stopListening, resetTrip } = useVoiceApp();

  return (
    <>
      <Header />
      <MapView />
      <TripCard />
      <GestureZone />
      <RecordButton
        recording={state.recording}
        onPress={startListening}
        onRelease={stopListening}
      />
      <AgentOverlay onDismiss={resetTrip} />
      <TripOverlay onDismiss={resetTrip} />
    </>
  );
}

function MainContainer() {
  const { state, dispatch } = useApp();

  const handleLogin = (userData) => {
    dispatch({ type: 'SET_USER', payload: userData });
  };

  if (!state.user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (state.user.role === 'driver') {
    return <DriverView user={state.user} />;
  }

  return <AppContent />;
}

export default function App() {
  return (
    <AppProvider>
      <MainContainer />
    </AppProvider>
  );
}
