/**
 * voice-nlu.js
 * Lightweight, offline intent + place understanding for the voice booking flow.
 * Runs entirely in the browser — no LLM key needed for the MVP. Reuses the graph
 * nodes from seed-data.js as the set of valid destinations and matches the
 * (often imperfect) speech-to-text output against them with fuzzy matching, which
 * directly tackles the "STT misheard the address" problem.
 */

// --- Vietnamese text normalization (strip accents, lowercase) ----------------
function normalizeVi(s) {
    return (s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// --- Dice coefficient on character bigrams (robust to small STT errors) ------
function bigrams(s) {
    const out = [];
    const t = s.replace(/\s/g, "");
    for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
    return out;
}
function diceSimilarity(a, b) {
    const A = bigrams(a), B = bigrams(b);
    if (A.length === 0 || B.length === 0) return a === b ? 1 : 0;
    const counts = new Map();
    A.forEach(g => counts.set(g, (counts.get(g) || 0) + 1));
    let inter = 0;
    B.forEach(g => {
        const c = counts.get(g) || 0;
        if (c > 0) { inter++; counts.set(g, c - 1); }
    });
    return (2 * inter) / (A.length + B.length);
}

// --- Aliases: spoken forms -> graph node id ---------------------------------
const PLACE_ALIASES = {
    n1: ["ben thanh", "cho ben thanh"],
    n2: ["nguyen hue", "pho di bo", "pho di bo nguyen hue"],
    n3: ["ton duc thang", "ba son"],
    n4: ["le loi"],
    n5: ["pasteur"],
    n6: ["hai ba trung"],
    n7: ["hang xanh", "nga tu hang xanh"],
    n8: ["nguyen huu canh", "landmark", "landmark 81", "vinhomes"],
    n11: ["dien bien phu"],
    n12: ["cau sai gon"],
    n13: ["cau khanh hoi", "khanh hoi"],
    n14: ["nguyen tat thanh"],
    n15: ["cau tan thuan", "tan thuan"],
    n16: ["huynh tan phat"],
    n17: ["nguyen van linh"],
    n18: ["crescent mall", "crescent", "phu my hung", "quan 7", "sc vivo", "ho ban nguyet"],
    n19: ["tran hung dao"],
    n20: ["nguyen van cu"],
    n21: ["duong ba trac"],
};

// Stop/command words removed to isolate the destination phrase.
const STOP_WORDS = new Set([
    "cho", "toi", "minh", "tao", "oi", "muon", "can", "lam", "on", "giup",
    "dat", "goi", "book", "xe", "om", "dien", "may", "o", "to", "oto", "taxi",
    "grab", "grabcar", "grabbike", "di", "den", "toi", "ra", "qua", "ve", "duong",
    "dia", "chi", "vui", "long", "a", "voi", "gia", "khoang",
]);

function destinationPhrase(transcript) {
    const norm = normalizeVi(transcript);
    const kept = norm.split(" ").filter(w => w && !STOP_WORDS.has(w));
    return kept.join(" ");
}

// --- Vehicle detection (token-based to avoid matching "ch-o t-oi" as "o to") --
function detectVehicle(transcript) {
    const words = normalizeVi(transcript).split(" ");
    const has = w => words.includes(w);
    const adjacent = (a, b) => words.some((w, i) => w === a && words[i + 1] === b);
    const carHit =
        has("oto") || has("taxi") || has("grabcar") ||
        adjacent("o", "to") || adjacent("xe", "hoi") ||
        adjacent("bon", "banh") || adjacent("4", "banh");
    return carHit ? "car" : "bike"; // default: xe ôm điện
}

const VEHICLE_LABEL = { bike: "xe ôm điện", car: "ô tô điện" };

// --- Resolve destination -> node --------------------------------------------
function resolvePlace(transcript) {
    const full = normalizeVi(transcript);
    const phrase = destinationPhrase(transcript) || full;

    let best = { nodeId: null, name: null, score: 0 };
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    for (const node of nodes) {
        const candidates = [normalizeVi(node.name), ...(PLACE_ALIASES[node.id] || [])];
        for (const cand of candidates) {
            // Exact containment is the strongest signal; else fuzzy on the phrase.
            let score;
            if (full.includes(cand) && cand.length >= 3) score = 1.0;
            else score = Math.max(diceSimilarity(phrase, cand), diceSimilarity(full, cand));
            if (score > best.score) {
                best = { nodeId: node.id, name: node.name, score };
            }
        }
    }
    best.node = best.nodeId ? nodeMap.get(best.nodeId) : null;
    return best;
}

// --- Pricing -----------------------------------------------------------------
const PRICE_TABLE = {
    bike: { base: 12000, perKm: 4000 },
    car: { base: 29000, perKm: 12000 },
};

function quotePrice(vehicle, distanceKm) {
    const p = PRICE_TABLE[vehicle] || PRICE_TABLE.bike;
    const raw = p.base + p.perKm * distanceKm;
    return Math.round(raw / 1000) * 1000; // round to nearest 1.000 đ
}

// --- Snap GPS coordinate to nearest graph node ------------------------------
function snapToNearestNode(lat, lng) {
    let best = null, bestD = Infinity;
    for (const node of nodes) {
        const d = Graph.haversineDistance(lat, lng, node.lat, node.lng);
        if (d < bestD) { bestD = d; best = node; }
    }
    return best;
}

/**
 * Full understanding step: text -> structured booking intent (no routing yet).
 * Returns { intent, vehicle, vehicleLabel, place: {nodeId,name,score}, needsRepeat }
 */
function understandCommand(transcript) {
    const place = resolvePlace(transcript);
    const vehicle = detectVehicle(transcript);
    const CONFIDENCE_MIN = 0.45;
    return {
        intent: "BOOK_RIDE",
        transcript,
        vehicle,
        vehicleLabel: VEHICLE_LABEL[vehicle],
        place,
        needsRepeat: !place.nodeId || place.score < CONFIDENCE_MIN,
    };
}
