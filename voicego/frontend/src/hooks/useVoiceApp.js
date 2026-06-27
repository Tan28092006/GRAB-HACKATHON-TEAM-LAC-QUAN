import { useCallback, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';
import { speak, stop as stopSpeech } from '../services/tts';
import VoiceRecorder from '../services/voiceRecorder';
import { understandCommand, VEHICLE_LABEL } from '../services/voiceNlu';
import Graph from '../services/graph';
import { connectSocket, emitPassengerWaiting, loginPassenger, disconnectSocket } from '../services/socket';

const REALTIME_PASSENGER = { phone: '0909000111', password: 'demo' };

export default function useVoiceApp() {
  const { state, dispatch } = useApp();
  const recorderRef = useRef(null);
  const busyRef = useRef(false);
  const socketRef = useRef(null);

  // Check backend health on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.checkHealth();
        if (!cancelled) dispatch({ type: 'SET_BACKEND_ONLINE', payload: data?.status === 'ok' });
      } catch {
        if (!cancelled) dispatch({ type: 'SET_BACKEND_ONLINE', payload: false });
      }
      // Announce ready
      dispatch({ type: 'SET_STATUS', payload: { main: 'Chạm mic và nói điểm đến', sub: '' } });
      speak('Xin chào! Chạm nút mic và nói điểm đến của bạn.');
    })();
    return () => { cancelled = true; };
  }, [dispatch]);

  // Start listening
  const startListening = useCallback(async () => {
    if (busyRef.current || state.recording) return;
    dispatch({ type: 'SET_RECORDING', payload: true });
    dispatch({ type: 'SET_STATUS', payload: { main: '🎙️ Đang nghe…', sub: 'Nói điểm đến của bạn' } });
    dispatch({ type: 'SET_TRANSCRIPT', payload: '' });
    stopSpeech();

    // Try browser SpeechRecognition first
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      _listenBrowser(SR);
    } else {
      _listenWhisper();
    }
  }, [state.recording, dispatch]);

  // Browser speech recognition
  const _listenBrowser = useCallback((SR) => {
    const recognition = new SR();
    recognition.lang = 'vi-VN';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let silenceTimer = null;

    recognition.onresult = (e) => {
      let interim = '';
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      dispatch({ type: 'SET_TRANSCRIPT', payload: interim || finalText });
      if (finalText) {
        clearTimeout(silenceTimer);
        recognition.stop();
        dispatch({ type: 'SET_RECORDING', payload: false });
        _send(finalText.trim());
      } else {
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => recognition.stop(), 2000);
      }
    };

    recognition.onerror = (e) => {
      console.warn('Speech recognition error:', e.error);
      dispatch({ type: 'SET_RECORDING', payload: false });
      if (e.error === 'no-speech') {
        dispatch({ type: 'SET_STATUS', payload: { main: 'Không nghe thấy', sub: 'Hãy chạm mic và thử lại' } });
      }
    };

    recognition.onend = () => {
      dispatch({ type: 'SET_RECORDING', payload: false });
    };

    recorderRef.current = recognition;
    recognition.start();
  }, [dispatch]);

  // Whisper fallback
  const _listenWhisper = useCallback(async () => {
    if (!recorderRef.current) recorderRef.current = new VoiceRecorder();
    const recorder = recorderRef.current;
    
    await recorder.start({
      onAutoStop: async () => {
        const wavBlob = await recorder.stop();
        dispatch({ type: 'SET_RECORDING', payload: false });
        if (wavBlob && wavBlob.size > 1000) {
          dispatch({ type: 'SET_STATUS', payload: { main: 'Đang nhận diện giọng nói…', sub: '' } });
          try {
            const text = await api.speechToText(wavBlob);
            if (text) {
              dispatch({ type: 'SET_TRANSCRIPT', payload: text });
              _send(text);
            } else {
              dispatch({ type: 'SET_STATUS', payload: { main: 'Không nghe rõ', sub: 'Chạm mic và thử lại' } });
            }
          } catch {
            dispatch({ type: 'SET_STATUS', payload: { main: 'Lỗi nhận diện', sub: 'Chạm mic và thử lại' } });
          }
        }
      },
    });
  }, [dispatch]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recorderRef.current) {
      if (recorderRef.current instanceof (window.SpeechRecognition || window.webkitSpeechRecognition || function(){})) {
        recorderRef.current.stop();
      } else if (recorderRef.current.stop) {
        recorderRef.current.stop();
      }
    }
    dispatch({ type: 'SET_RECORDING', payload: false });
  }, [dispatch]);

  // Send text to agent (or local fallback)
  const _send = useCallback(async (text) => {
    if (busyRef.current) return;
    busyRef.current = true;
    dispatch({ type: 'SET_BUSY', payload: true });
    dispatch({ type: 'SET_STATUS', payload: { main: '🤖 Đang xử lý…', sub: text } });

    try {
      if (state.backendOnline) {
        // Online mode: use agent
        const newMessages = [...state.messages, { role: 'user', content: text }];
        dispatch({ type: 'SET_MESSAGES', payload: newMessages });

        const result = await api.agentChat(newMessages);
        const { reply, messages: updatedMsgs, ui } = result;

        dispatch({ type: 'SET_MESSAGES', payload: updatedMsgs || newMessages });
        dispatch({ type: 'SET_STATUS', payload: { main: reply || 'Đã xử lý', sub: '' } });

        // Apply UI side-effects
        if (ui) {
          if (ui.destination) {
            dispatch({ type: 'SET_DESTINATION', payload: ui.destination });
            dispatch({ type: 'SET_STATE', payload: 'destination_set' });
          }
          if (ui.quote) {
            dispatch({ type: 'SET_QUOTE', payload: ui.quote });
            dispatch({ type: 'SET_STATE', payload: 'confirming' });
          }
          if (ui.booked) {
            dispatch({ type: 'SET_BOOKING', payload: ui.booked });
            dispatch({ type: 'SET_DRIVER', payload: ui.booked.driver });
            dispatch({ type: 'SET_STATE', payload: 'booking' });
            // Show agent overlay with typewriter effect
            dispatch({ type: 'SET_AGENT_LOG', payload: [] });
            dispatch({ type: 'SET_AGENT_RESULT', payload: '' });
            _showBooked(ui.booked, reply);
          }
          if (ui.ended) {
            dispatch({ type: 'RESET_TRIP' });
          }
        }

        // Speak the reply
        if (reply) await speak(reply);
      } else {
        // Offline fallback
        _localFallback(text);
      }
    } catch (err) {
      console.error('Agent error:', err);
      // Try local fallback on error
      _localFallback(text);
    } finally {
      busyRef.current = false;
      dispatch({ type: 'SET_BUSY', payload: false });
    }
  }, [state.backendOnline, state.messages, dispatch]);

  // Local fallback using voice-nlu
  const _localFallback = useCallback((text) => {
    const result = understandCommand(text);
    if (result.place) {
      const dest = { name: result.place.name, lat: result.place.lat, lng: result.place.lng };
      const distKm = Graph.haversineDistance(
        state.origin.lat, state.origin.lng, dest.lat, dest.lng
      ) / 1000;
      const price = result.vehicleLabel 
        ? (result.vehicle === 'car' ? 29000 + 12000 * distKm : 12000 + 4000 * distKm)
        : 12000 + 4000 * distKm;
      
      dispatch({ type: 'SET_DESTINATION', payload: dest });
      dispatch({ type: 'SET_QUOTE', payload: { price: Math.round(price), distance: distKm.toFixed(1) } });
      dispatch({ type: 'SET_STATE', payload: 'confirming' });
      
      const msg = `Điểm đến: ${dest.name}. Khoảng cách ${distKm.toFixed(1)} km. Giá ${Math.round(price).toLocaleString('vi')} đồng. Nói đồng ý để đặt xe.`;
      dispatch({ type: 'SET_STATUS', payload: { main: msg, sub: '' } });
      speak(msg);
    } else {
      dispatch({ type: 'SET_STATUS', payload: { main: 'Không nhận ra điểm đến', sub: 'Hãy thử lại' } });
      speak('Xin lỗi, tôi không nhận ra điểm đến. Hãy thử nói lại.');
    }
  }, [state.origin, dispatch]);

  // Show booked overlay with typewriter effect
  const _showBooked = useCallback(async (booked, reply) => {
    dispatch({ type: 'SET_STATE', payload: 'booking' });
    // Typewriter the reply into agent log
    if (reply) {
      const words = reply.split(' ');
      for (let i = 0; i < words.length; i++) {
        dispatch({ type: 'ADD_AGENT_LOG', payload: words.slice(0, i + 1).join(' ') });
        await new Promise(r => setTimeout(r, 50));
      }
    }
    // Show driver result
    const driver = booked.driver;
    if (driver) {
      dispatch({ type: 'SET_AGENT_RESULT', payload: `Tài xế: ${driver.name} — ${driver.plate}` });
    }
    // Start realtime
    _startRealtime(booked, reply);
  }, [dispatch]);

  // Start realtime driver tracking
  const _startRealtime = useCallback(async (booked) => {
    const params = new URLSearchParams(window.location.search);
    const realtimeUrl = params.get('realtime') || 'http://localhost:3001';
    
    try {
      await loginPassenger(realtimeUrl, REALTIME_PASSENGER);
    } catch (e) {
      console.warn('Realtime login failed:', e);
    }

    const socket = connectSocket({
      onDriverArrived: (data) => {
        dispatch({ type: 'SET_STATE', payload: 'trip_live' });
        dispatch({ type: 'SET_PIN', payload: data.pin || '1234' });
        dispatch({ type: 'SET_DRIVER', payload: data.driver || booked.driver });
        const pinStr = (data.pin || '1234').split('').join(' ');
        speak(`Tài xế đã đến. Mã PIN của bạn là ${pinStr}`);
      },
      onPinVerified: () => {
        speak('Đã xác minh. Chúc bạn có chuyến đi an toàn!');
        setTimeout(() => dispatch({ type: 'RESET_TRIP' }), 3000);
      },
    });
    socketRef.current = socket;
    emitPassengerWaiting({ booking: booked });
  }, [dispatch]);

  // Reset trip
  const resetTrip = useCallback(() => {
    disconnectSocket();
    dispatch({ type: 'RESET_TRIP' });
  }, [dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectSocket();
      stopSpeech();
    };
  }, []);

  return {
    state,
    startListening,
    stopListening,
    resetTrip,
  };
}
