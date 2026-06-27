import { textToSpeech } from './api';

let currentAudio = null;

export async function speak(text) {
  stop(); 
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const blob = await textToSpeech(text);
      if (blob && blob.size > 0) {
        const url = URL.createObjectURL(blob);
        return new Promise((resolve) => {
          currentAudio = new Audio(url);
          currentAudio.onended = () => { URL.revokeObjectURL(url); currentAudio = null; resolve(); };
          currentAudio.onerror = () => { URL.revokeObjectURL(url); currentAudio = null; resolve(); };
          currentAudio.play().catch(() => resolve());
        });
      }
    } catch (e) {
      console.warn(`TTS attempt ${attempt + 1} failed:`, e);
    }
  }
  return browserSpeak(text);
}

export function browserSpeak(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'vi-VN';
    utter.rate = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find(v => v.lang.startsWith('vi'));
    if (viVoice) utter.voice = viVoice;
    utter.onend = resolve;
    utter.onerror = resolve;
    window.speechSynthesis.speak(utter);
  });
}

export function stop() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}
