/**
 * voice-app.js
 * Accessible, voice-first ride booking for users with motor/visual impairments.
 *
 * Pipeline:  hold-to-talk -> WAV -> FPT STT -> JS NLU -> local-engine route ->
 *            price -> FPT TTS confirmation -> double-tap to confirm.
 *
 * Resilience: if the backend (FPT proxy) is unreachable, the user can still TYPE
 * a command; routing/pricing run locally and the browser's own TTS reads back.
 */

const BACKEND_URL = "http://localhost:8000";

class VoiceBookingApp {
    constructor() {
        this.recorder = new VoiceRecorder();
        this.state = "idle"; // idle | listening | processing | confirming | booked
        this.pending = null;
        this.originNode = nodes.find(n => n.id === "n1"); // default Bến Thành
        this.audio = new Audio();
        this.routeMap = (typeof RouteMap !== "undefined" && document.getElementById("route-map"))
            ? new RouteMap("route-map") : null;

        this.els = {
            status: document.getElementById("status"),
            substatus: document.getElementById("substatus"),
            recordBtn: document.getElementById("record-btn"),
            gestureZone: document.getElementById("gesture-zone"),
            vehiclePill: document.getElementById("vehicle-pill"),
            backendDot: document.getElementById("backend-dot"),
            textInput: document.getElementById("text-fallback"),
            textSend: document.getElementById("text-send"),
        };

        this._bindGestures();
        this.init();
    }

    async init() {
        this.announce("Chào bạn.", "Chạm và giữ nửa dưới màn hình rồi nói điểm đến.", true);
        this._checkBackend();
        this._initGeo();
    }

    // ----- Status + speech ---------------------------------------------------
    announce(main, sub = "", speak = false) {
        if (this.els.status) this.els.status.textContent = main;
        if (this.els.substatus) this.els.substatus.textContent = sub;
        if (speak) this.speak(sub ? `${main} ${sub}` : main);
    }

    async speak(text) {
        // Prefer FPT TTS via backend; fall back to the browser's speech engine.
        try {
            const res = await fetch(`${BACKEND_URL}/api/voice/tts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
                signal: AbortSignal.timeout(12000),
            });
            if (!res.ok) throw new Error("tts http " + res.status);
            const blob = await res.blob();
            this.audio.src = URL.createObjectURL(blob);
            await this.audio.play();
            return;
        } catch (e) {
            this._browserSpeak(text);
        }
    }

    _browserSpeak(text) {
        if (!("speechSynthesis" in window)) return;
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "vi-VN";
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
    }

    _vibrate(pattern) {
        if (navigator.vibrate) navigator.vibrate(pattern);
    }

    // ----- Backend + GPS -----------------------------------------------------
    async _checkBackend() {
        try {
            const r = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
            this._setBackend(r.ok);
        } catch {
            this._setBackend(false);
        }
    }
    _setBackend(ok) {
        if (!this.els.backendDot) return;
        this.els.backendDot.textContent = ok ? "🟢 Giọng nói FPT" : "⚡ Chế độ gõ/đọc cục bộ";
        this.els.backendDot.className = "backend-dot " + (ok ? "online" : "offline");
        this.backendOk = ok;
    }

    _initGeo() {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            pos => {
                this.gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                const snapped = snapToNearestNode(pos.coords.latitude, pos.coords.longitude);
                if (snapped) {
                    this.originNode = snapped;
                    if (this.els.substatus) this.els.substatus.textContent += ` (Điểm đón: ${snapped.name})`;
                }
            },
            () => { /* denied — keep default origin */ },
            { timeout: 5000 }
        );
    }

    // ----- Recording (hold-to-talk) -----------------------------------------
    async startListening() {
        if (this.state === "listening" || this.state === "processing") return;
        try {
            await this.recorder.start();
        } catch (e) {
            this.announce("Không truy cập được micro.", "Bạn có thể gõ lệnh ở ô bên dưới.", true);
            return;
        }
        this.state = "listening";
        this._vibrate(40);
        if (this.els.recordBtn) this.els.recordBtn.classList.add("recording");
        this.announce("Đang nghe…", "Nói điểm đến của bạn, ví dụ: cho tôi đi Bến Thành.");
    }

    async stopListening() {
        if (this.state !== "listening") return;
        const wav = this.recorder.stop();
        if (this.els.recordBtn) this.els.recordBtn.classList.remove("recording");
        this.state = "processing";
        this._vibrate(20);
        this.announce("Đang nhận diện…", "");

        try {
            const fd = new FormData();
            fd.append("file", wav, "speech.wav");
            const res = await fetch(`${BACKEND_URL}/api/voice/stt`, {
                method: "POST", body: fd, signal: AbortSignal.timeout(30000),
            });
            const j = await res.json();
            const text = (j.text || "").trim();
            if (!text) {
                this.state = "idle";
                this.announce("Chưa nghe rõ.", "Bạn hãy giữ nút và nói lại giúp tôi.", true);
                return;
            }
            this.processText(text);
        } catch (e) {
            this.state = "idle";
            this.announce("Lỗi nhận diện giọng nói.", "Hãy bật backend hoặc gõ lệnh ở ô bên dưới.", true);
        }
    }

    /**
     * Understand a command: try the Gemini-backed NLU first (handles messy /
     * complex phrasing), fall back to the on-device fuzzy matcher when the
     * backend or Gemini is unavailable — so it still works fully offline.
     */
    async _understand(transcript) {
        try {
            const res = await fetch(`${BACKEND_URL}/api/voice/nlu`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: transcript }),
                signal: AbortSignal.timeout(8000),
            });
            const j = await res.json();
            if (j.ok && j.nodeId) {
                const node = nodes.find(n => n.id === j.nodeId);
                return {
                    transcript,
                    vehicle: j.vehicle,
                    vehicleLabel: VEHICLE_LABEL[j.vehicle],
                    place: { nodeId: j.nodeId, name: j.destinationName, node, score: 1 },
                    needsRepeat: false,
                    source: "gemini",
                };
            }
        } catch (e) {
            // ignore — fall through to local matcher
        }
        return understandCommand(transcript); // on-device fallback
    }

    // ----- Understand -> route -> quote -------------------------------------
    async processText(transcript) {
        const u = await this._understand(transcript);

        // Known place (in the 21-node demo graph) -> real route + price.
        if (!u.needsRepeat && u.place.nodeId) {
            const routes = findMultipleRoutes(this.originNode.id, u.place.nodeId, floodZones, vehicleConfig);
            const route = routes.safest;
            if (!route || route.error) {
                this.state = "idle";
                this.announce(`Không thể đến ${u.place.name} lúc này.`, "Bạn thử điểm khác giúp tôi nhé.", true);
                return;
            }
            const km = route.totalDistance / 1000;
            const destNode = u.place.node || nodes.find(n => n.id === u.place.nodeId);
            this.pending = { place: u.place, vehicle: u.vehicle, route, km, destNode };
            if (this.routeMap && destNode) this.routeMap.showRoute(route, this.originNode, destNode);
            this._announceQuote(true);
            return;
        }

        // Not in the known list -> resolve an arbitrary place via grounded geocoding.
        this.announce("Đang tìm địa điểm…", "");
        const g = await this._geocode(transcript);
        if (g && g.ok) {
            const km = g.distanceKm != null ? g.distanceKm
                : Graph.haversineDistance(this.originNode.lat, this.originNode.lng, g.lat, g.lng) / 1000;
            this.pending = {
                place: { name: g.name, address: g.address, lat: g.lat, lng: g.lng },
                vehicle: u.vehicle, km, geocoded: true, confidence: g.confidence, source: g.source,
            };
            if (this.routeMap) this.routeMap.showPoint(this.originNode, g.lat, g.lng);
            this._announceQuote(true);
            return;
        }

        this.state = "idle";
        this.announce(`Bạn nói: "${transcript}".`, "Tôi chưa tìm được điểm đến. Bạn nói lại tên địa điểm rõ hơn giúp tôi.", true);
    }

    /** Resolve an arbitrary place name to a real address + coords (backend). */
    async _geocode(transcript) {
        try {
            const res = await fetch(`${BACKEND_URL}/api/voice/geocode`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: transcript, lat: this.gps?.lat, lng: this.gps?.lng }),
                signal: AbortSignal.timeout(20000),
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    }

    _announceQuote(speak) {
        const p = this.pending;
        if (!p) return;
        this.state = "confirming";
        const price = quotePrice(p.vehicle, p.km);
        p.price = price;
        const priceK = Math.round(price / 1000);
        const label = VEHICLE_LABEL[p.vehicle];

        if (this.els.vehiclePill) this.els.vehiclePill.textContent = label;

        const main = `Đi ${p.place.name} bằng ${label}`;
        // For geocoded places, read back the full address + distance as a safety
        // cue (a surprising distance lets the user catch a wrong destination).
        const addr = p.geocoded && p.place.address ? `${p.place.address}. ` : "";
        const sub = `${addr}Khoảng ${p.km.toFixed(1)} cây số, giá ${priceK} nghìn đồng. ` +
                    `Chạm hai lần để đồng ý, vuốt ngang để đổi xe, vuốt xuống để hủy.`;
        this.announce(main, sub, speak);
    }

    changeVehicle() {
        if (this.state !== "confirming" || !this.pending) return;
        this.pending.vehicle = this.pending.vehicle === "bike" ? "car" : "bike";
        this._vibrate(30);
        this._announceQuote(true);
    }

    confirmBooking() {
        if (this.state !== "confirming" || !this.pending) return;
        this.state = "booked";
        this._vibrate([40, 60, 40]);
        const p = this.pending;
        this.announce(
            `Đã đặt ${VEHICLE_LABEL[p.vehicle]} đi ${p.place.name}.`,
            "Đang tìm tài xế gần bạn. Vui lòng chờ trong giây lát.",
            true
        );
        // Mock driver assignment
        setTimeout(() => {
            if (this.state !== "booked") return;
            this.announce(
                "Đã tìm thấy tài xế!",
                `Tài xế Nguyễn Văn A, biển số 59-X1 234.56, đang đến điểm đón ${this.originNode.name} trong 4 phút.`,
                true
            );
        }, 3500);
    }

    cancelBooking() {
        if (this.state === "idle") return;
        this.state = "idle";
        this.pending = null;
        this._vibrate(80);
        this.announce("Đã hủy.", "Chạm và giữ để đặt chuyến mới.", true);
    }

    // ----- Gestures ----------------------------------------------------------
    _bindGestures() {
        const btn = this.els.recordBtn;
        if (btn) {
            const start = (e) => { e.preventDefault(); this.startListening(); };
            const stop = (e) => { e.preventDefault(); this.stopListening(); };
            btn.addEventListener("pointerdown", start);
            btn.addEventListener("pointerup", stop);
            btn.addEventListener("pointerleave", stop);
            btn.addEventListener("pointercancel", stop);
        }

        const zone = this.els.gestureZone;
        if (zone) {
            let lastTap = 0, sx = 0, sy = 0, st = 0;
            zone.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; st = Date.now(); });
            zone.addEventListener("pointerup", (e) => {
                const dx = e.clientX - sx, dy = e.clientY - sy, dt = Date.now() - st;
                if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { this.changeVehicle(); return; }
                if (dy > 70 && dy > Math.abs(dx)) { this.cancelBooking(); return; }
                // Treat as a tap; detect double-tap.
                if (dt < 300 && Math.abs(dx) < 30 && Math.abs(dy) < 30) {
                    const now = Date.now();
                    if (now - lastTap < 350) { this.confirmBooking(); lastTap = 0; }
                    else lastTap = now;
                }
            });
        }

        // Typed fallback (works even with no backend / noisy environment)
        if (this.els.textSend && this.els.textInput) {
            const submit = () => {
                const v = this.els.textInput.value.trim();
                if (v) { this.state = "processing"; this.processText(v); }
            };
            this.els.textSend.addEventListener("click", submit);
            this.els.textInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
        }

        // Keyboard shortcuts for accessibility testing (Space=confirm, Esc=cancel)
        document.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && this.state === "confirming") { e.preventDefault(); this.confirmBooking(); }
            if (e.key === "Escape") this.cancelBooking();
        });
    }
}

document.addEventListener("DOMContentLoaded", () => { window.voiceApp = new VoiceBookingApp(); });
