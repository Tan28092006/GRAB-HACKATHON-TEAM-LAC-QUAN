# VoiceGo — Tech Stack & Architecture

## Tech stack
| Lớp | Công nghệ |
|---|---|
| Frontend | React 18 + Vite, Leaflet (bản đồ), Socket.IO client, CSS thuần |
| Backend | Python 3 + FastAPI + Uvicorn |
| STT (nhận giọng) | **FPT.AI ASR** (chính) · **Groq Whisper** `whisper-large-v3-turbo` (fallback) |
| TTS (đọc) | **FPT.AI TTS** (giọng banmai) · `speechSynthesis` trình duyệt (fallback) |
| Agent (hội thoại) | **Groq** `openai/gpt-oss-120b` — function-calling (ReAct) |
| Geocoding | Gazetteer nội bộ (đã xác minh) → **Nominatim/OpenStreetMap** → (tuỳ chọn Gemini grounding) |
| Routing | **OSRM** (quãng đường/thời gian/đường đi thật) |
| DB | **MongoDB** (Atlas) — user, accessibility profile, rides, reports |
| Realtime tài xế | **Socket.IO** server (cổng 3001) — ghép khách↔tài xế, PIN |

## Sơ đồ luồng
```
[Người dùng]
  │ nói (giọng)
  ▼
Frontend React ──STT──▶  /api/voice/stt  ──▶ FPT.AI ASR (fallback Groq Whisper)
  │  text
  ▼
/api/agent/chat ──▶ Agent (Groq gpt-oss-120b, function-calling)
        │  tools:
        │   • resolve_destination ─▶ gazetteer + Nominatim (chỉ HCMC, chống hallucinate)
        │   • select_candidate    ─▶ chọn cơ sở / cổng tiếp cận
        │   • get_quote           ─▶ OSRM (km, phút, giá)
        │   • book_ride           ─▶ MongoDB (tạo chuyến)
        │   • end_conversation
        ▼
   {reply, ui}  ──TTS──▶ /api/voice/tts ─▶ FPT.AI (đọc trả lời)
        │
        ▼  (sau khi đặt)
   Socket.IO (3001): passenger-waiting → driver-accepted → driver-arrived(+PIN)
                     → verify-pin → trip-completed
        ▼
   Bản đồ Leaflet: ghim điểm đi/đến, tô XANH điểm dễ tiếp cận, vẽ tuyến OSRM
```

## Quyết định thiết kế chính
- **LLM không bao giờ bịa toạ độ.** Agent chỉ rút tên địa điểm + dẫn dắt; toạ độ đến từ gazetteer đã xác minh hoặc OSM thật. Ngoài HCMC → từ chối.
- **Nơi nhiều chi nhánh** → liệt kê ứng viên thật để khách chọn (tổng quát qua geocoder, không hardcode từng nơi).
- **Tiếp cận (accessibility)**: gợi ý cổng/điểm đón dễ tiếp cận (vd ĐH Bách Khoa cơ sở 1 — hardcode toạ độ cổng), tô xanh trên bản đồ; thu thập đánh giá accessibility của điểm đến (`/api/reports`).
- **Hands-free + an toàn**: tự chào/tự nghe, đọc lại PIN 2 lần, xác minh PIN trước khi lên xe.

## Cấu trúc thư mục (rút gọn)
```
voicego/
├─ backend/        FastAPI: main.py, agent.py, geocode.py, places_db.py, voice.py, db.py, seed_from_csv.py
├─ frontend/       React/Vite: src/{App.jsx, hooks/useVoiceApp.js, components/*, services/*, styles/*}
├─ SETUP.md  USER_GUIDE.md  ARCHITECTURE.md  ATTRIBUTION.md  REALTIME_INTEGRATION.md
```

## API chính
`/api/auth/login` · `/api/voice/stt` · `/api/voice/tts` · `/api/agent/chat` · `/api/voice/geocode` · `/api/rides` · `/api/reports` · `/api/db/seed` · `/api/health`
