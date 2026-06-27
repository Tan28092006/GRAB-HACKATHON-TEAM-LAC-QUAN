import { nodes, edges, floodZones, chargingStations } from './seedData.js';

// ---------------------------------------------------------------------------
// Battery / range helpers
// ---------------------------------------------------------------------------

function estimateRemainingRange(vehicleConfig) {
    // Range until the minimum safe SOC reserve (not down to empty).
    const minSafe = vehicleConfig.minSafeSocPercent != null ? vehicleConfig.minSafeSocPercent : 10;
    const usableSoc = Math.max(0, vehicleConfig.currentSocPercent - minSafe);
    const usableKwh = vehicleConfig.batteryCapacityKwh * (usableSoc / 100);
    const consumption = vehicleConfig.consumptionKwhPerKm || 0.18;
    return usableKwh / consumption; // km
}

// ---------------------------------------------------------------------------
// Calibrated rainfall -> flood depth model (for the live rainfall slider)
// Each zone's seed `depthCm` is treated as its peak/design depth; rainfall
// scales the current depth between dry and design depth around triggerRainMm.
// ---------------------------------------------------------------------------

function applyRainfallToFloodZones(rainfallMm) {
    floodZones.forEach(fz => {
        // Only zones flagged "in play" by the current scenario can flood.
        if (!fz._inPlay) {
            fz.depthCm = 0;
            fz.isActive = false;
            return;
        }
        const design = fz._designDepthCm != null ? fz._designDepthCm : fz.depthCm;
        const trigger = fz.triggerRainMm || 50;
        let depth;
        if (rainfallMm <= trigger) {
            // Minor pooling below the trigger threshold.
            depth = design * 0.15 * (rainfallMm / trigger);
        } else {
            // Ramp from 30% to 100% of design depth over ~40mm above trigger.
            depth = design * Math.min(1, 0.3 + 0.7 * (rainfallMm - trigger) / 40);
        }
        fz.depthCm = Math.round(depth);
        fz.isActive = fz.depthCm >= 5;
    });
}

// ---------------------------------------------------------------------------
// Graph + cost helpers (mirror of ecsp_router.py)
// ---------------------------------------------------------------------------

function _buildAdjacency(edgeList) {
    const adj = new Map();
    edgeList.forEach(e => {
        if (!adj.has(e.from)) adj.set(e.from, []);
        adj.get(e.from).push(e);
    });
    return adj;
}

function _stationNodeSet() {
    return new Set(chargingStations.filter(s => s.available).map(s => s.nearestNode));
}

function _stationByNode(nodeId) {
    return chargingStations.find(s => s.nearestNode === nodeId && s.available) || null;
}

function _floodDepthForEdge(edgeId, activeFloodZones) {
    for (const fz of activeFloodZones) {
        if (fz.isActive && (fz.affectedEdges || []).includes(edgeId)) {
            return fz.depthCm;
        }
    }
    return 0;
}

/**
 * Returns [timeCost, energyKwh, warningOrNull].
 * [Infinity, Infinity, warning] means the edge is impassable in this mode.
 */
function _edgeCosts(edge, activeFloodZones, vcfg, mode) {
    const maxWade = vcfg.maxWadeDepthCm != null ? vcfg.maxWadeDepthCm : 15;
    const consumption = vcfg.consumptionKwhPerKm || 0.18;
    const distKm = edge.distance / 1000;

    const depth = _floodDepthForEdge(edge.id, activeFloodZones);
    let warning = null;
    let timeFactor = 1.0;
    let energyFactor = 1.0;

    if (depth > 0) {
        const unsafe = depth > maxWade;
        warning = {
            edgeId: edge.id,
            roadName: edge.roadName || "",
            depthCm: depth,
            unsafeForEv: unsafe,
        };
        if (mode === "safe" && unsafe) {
            return [Infinity, Infinity, warning];
        }
        if (mode === "safe") timeFactor = 3.0;
        else if (mode === "balanced") timeFactor = unsafe ? 4.0 : 2.0;
        else timeFactor = unsafe ? 1.15 : 1.05;

        if (unsafe) energyFactor = mode !== "safe" ? 2.0 : 1.0;
        else if (depth > 5) energyFactor = 1.3;
        else energyFactor = 1.1;
    }

    if ((edge.elevation != null ? edge.elevation : 2.0) > 3.0) {
        timeFactor *= mode === "safe" ? 0.9 : 0.95;
    }

    return [edge.baseTime * timeFactor, distKm * consumption * energyFactor, warning];
}

function _discretizeBattery(socPercent) {
    return Math.max(0, Math.min(100, Math.round(socPercent)));
}

// Minimal binary min-heap keyed on numeric priority (g cost).
class _MinHeap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    push(item) {
        const a = this.a;
        a.push(item);
        let i = a.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (a[p][0] <= a[i][0]) break;
            [a[p], a[i]] = [a[i], a[p]];
            i = p;
        }
    }
    pop() {
        const a = this.a;
        const top = a[0];
        const last = a.pop();
        if (a.length > 0) {
            a[0] = last;
            let i = 0;
            const n = a.length;
            while (true) {
                const l = 2 * i + 1, r = 2 * i + 2;
                let s = i;
                if (l < n && a[l][0] < a[s][0]) s = l;
                if (r < n && a[r][0] < a[s][0]) s = r;
                if (s === i) break;
                [a[s], a[i]] = [a[i], a[s]];
                i = s;
            }
        }
        return top;
    }
}

// ---------------------------------------------------------------------------
// ECSP-Dijkstra (state = node + battery bucket, with charging branches)
// ---------------------------------------------------------------------------

function _ecspDijkstra(startId, endId, activeFloodZones, vcfg, mode, adj, nodeMap) {
    if (!nodeMap.has(startId) || !nodeMap.has(endId)) {
        return { error: "INVALID_NODES" };
    }

    const batteryKwh = vcfg.batteryCapacityKwh || 60.0;
    const startSoc = vcfg.currentSocPercent != null ? vcfg.currentSocPercent : 85;
    const minSoc = vcfg.minSafeSocPercent != null ? vcfg.minSafeSocPercent : 10;
    const startEnergy = batteryKwh * startSoc / 100.0;
    const minEnergy = batteryKwh * minSoc / 100.0;
    const stationNodes = _stationNodeSet();

    const startBucket = _discretizeBattery(startSoc);
    const dist = new Map();
    const prev = new Map();
    const key = (n, b) => n + "|" + b;

    dist.set(key(startId, startBucket), 0.0);
    const pq = new _MinHeap();
    pq.push([0.0, startId, startBucket, startEnergy]);

    while (pq.size > 0) {
        const [g, node, bucket, energy] = pq.pop();
        const stateKey = key(node, bucket);
        if (g > (dist.has(stateKey) ? dist.get(stateKey) : Infinity)) continue;

        if (node === endId) {
            return _reconstruct(prev, [node, bucket], g, activeFloodZones, vcfg, mode, nodeMap);
        }

        const neighbors = adj.get(node) || [];
        for (const edge of neighbors) {
            const [timeCost, energyCost] = _edgeCosts(edge, activeFloodZones, vcfg, mode);
            if (timeCost === Infinity) continue;

            const newEnergy = energy - energyCost;
            if (newEnergy < minEnergy) continue;

            const newG = g + timeCost;
            const newBucket = _discretizeBattery(newEnergy / batteryKwh * 100);
            const newKey = key(edge.to, newBucket);

            if (newG < (dist.has(newKey) ? dist.get(newKey) : Infinity)) {
                dist.set(newKey, newG);
                prev.set(newKey, [node, bucket, edge, false]);
                pq.push([newG, edge.to, newBucket, newEnergy]);
            }
        }

        // Charging branch: top up to 80% at a station node.
        if (stationNodes.has(node) && bucket < 80) {
            const station = _stationByNode(node);
            if (station) {
                const targetSoc = 80;
                const targetEnergy = batteryKwh * targetSoc / 100.0;
                const kwhToAdd = targetEnergy - energy;
                if (kwhToAdd > 0) {
                    let chargeSec = (kwhToAdd / station.powerKw) * 3600;
                    chargeSec += (station.waitTimeMin || 0) * 60;
                    const newGCharged = g + chargeSec;
                    const chargedBucket = _discretizeBattery(targetSoc);
                    const chargedKey = key(node, chargedBucket);
                    if (newGCharged < (dist.has(chargedKey) ? dist.get(chargedKey) : Infinity)) {
                        dist.set(chargedKey, newGCharged);
                        prev.set(chargedKey, [node, bucket, null, true]);
                        pq.push([newGCharged, node, chargedBucket, targetEnergy]);
                    }
                }
            }
        }
    }

    return { error: "NO_SAFE_ROUTE" };
}

function _reconstruct(prev, goalState, totalTime, activeFloodZones, vcfg, mode, nodeMap) {
    const batteryKwh = vcfg.batteryCapacityKwh || 60.0;
    const consumption = vcfg.consumptionKwhPerKm || 0.18;
    const maxWade = vcfg.maxWadeDepthCm != null ? vcfg.maxWadeDepthCm : 15;
    const key = (n, b) => n + "|" + b;

    const pathNodes = [];
    const edgesUsed = [];
    const chargingStops = [];
    const floodWarnings = [];
    let totalDistance = 0;
    let baseTime = 0;
    let lastCharged = false;

    let state = goalState; // [node, bucket]
    while (prev.has(key(state[0], state[1]))) {
        const [pNode, pBucket, edge, charged] = prev.get(key(state[0], state[1]));
        if (charged) {
            const station = _stationByNode(state[0]);
            if (station) {
                chargingStops.push({
                    nodeId: state[0],
                    nodeName: nodeMap.get(state[0]).name,
                    stationName: station.name,
                    fromSoc: pBucket,
                    toSoc: state[1],
                    pricePerKwh: station.pricePerKwh,
                    powerKw: station.powerKw,
                });
            }
        } else if (edge) {
            pathNodes.push(state[0]);
            edgesUsed.push(edge);
            totalDistance += edge.distance;
            baseTime += edge.baseTime;
            const depth = _floodDepthForEdge(edge.id, activeFloodZones);
            if (depth > 0) {
                floodWarnings.push({
                    edgeId: edge.id,
                    roadName: edge.roadName || "",
                    depthCm: depth,
                    unsafeForEv: depth > maxWade,
                });
            }
        }
        state = [pNode, pBucket];
    }

    pathNodes.push(state[0]); // start node
    pathNodes.reverse();
    edgesUsed.reverse();
    floodWarnings.reverse();
    chargingStops.reverse();

    // Risk score
    let riskRaw = 0;
    for (const w of floodWarnings) {
        const over = Math.max(0, w.depthCm - maxWade);
        riskRaw += 20 + over * 2;
    }
    const riskScore = Math.min(100, riskRaw);

    // Battery at end
    const batteryUsedPct = ((totalDistance / 1000) * consumption / batteryKwh) * 100;
    const startSoc = vcfg.currentSocPercent != null ? vcfg.currentSocPercent : 85;
    let finalSoc = startSoc - batteryUsedPct;
    if (chargingStops.length > 0) {
        finalSoc = chargingStops[chargingStops.length - 1].toSoc - batteryUsedPct * 0.3;
    }
    finalSoc = Math.max(0, Math.min(100, finalSoc));

    const labelMap = {
        safe: "Tuyến an toàn nhất",
        balanced: "Tuyến cân bằng",
        fast: "Tuyến nhanh nhất",
    };

    return {
        label: labelMap[mode] || "Route",
        mode: mode,
        path: pathNodes,
        edges: edgesUsed.map(e => ({
            id: e.id, from: e.from, to: e.to,
            distance: e.distance, roadName: e.roadName || "",
        })),
        totalDistance: totalDistance,
        totalTime: Math.round(totalTime),
        baseTime: baseTime,
        riskScore: riskScore,
        floodWarnings: floodWarnings,
        estimatedBatteryAtEnd: Math.round(finalSoc * 10) / 10,
        needsCharging: finalSoc < (vcfg.lowBatteryThreshold || 25),
        chargingStops: chargingStops,
    };
}

// ---------------------------------------------------------------------------
// Public API (same name/shape as the backend response)
// ---------------------------------------------------------------------------

function findMultipleRoutes(startId, endId, activeFloodZones, vehicleConfig) {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const adj = _buildAdjacency(edges);
    return {
        safest: _ecspDijkstra(startId, endId, activeFloodZones, vehicleConfig, "safe", adj, nodeMap),
        balanced: _ecspDijkstra(startId, endId, activeFloodZones, vehicleConfig, "balanced", adj, nodeMap),
        fastest: _ecspDijkstra(startId, endId, activeFloodZones, vehicleConfig, "fast", adj, nodeMap),
    };
}

export {
  findMultipleRoutes,
  applyRainfallToFloodZones,
  estimateRemainingRange
};
