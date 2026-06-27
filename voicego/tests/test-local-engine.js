/**
 * test-local-engine.js
 * Unit tests for the pure-JS fallback engine (js/local-engine.js), which
 * mirrors backend/ecsp_router.py. Uses the real seed data loaded globally.
 */

function _activeZone(id) {
    // Clone a seed flood zone and force it active for routing tests.
    const fz = floodZones.find(z => z.id === id);
    return { ...fz, isActive: true, depthCm: fz._designDepthCm != null ? fz._designDepthCm : fz.depthCm };
}

TestRunner.test('LocalEngine: estimateRemainingRange (down to min safe SOC)', () => {
    const config = {
        batteryCapacityKwh: 60.0,
        currentSocPercent: 75,
        minSafeSocPercent: 10,
        consumptionKwhPerKm: 0.2,
    };
    // (75 - 10)% of 60kWh = 39kWh usable; 39 / 0.2 = 195 km
    TestRunner.assert.equal(estimateRemainingRange(config), 195);
});

TestRunner.test('LocalEngine: normal trip returns a safe route with no warnings', () => {
    const routes = findMultipleRoutes('n1', 'n15', [], vehicleConfig);
    TestRunner.assert.isTrue(!routes.safest.error, 'safest route should exist');
    TestRunner.assert.isTrue(routes.safest.path.length >= 2, 'path should have nodes');
    TestRunner.assert.equal(routes.safest.riskScore, 0);
    TestRunner.assert.equal(routes.safest.floodWarnings.length, 0);
});

TestRunner.test('LocalEngine: safest route avoids flooded-unsafe edges', () => {
    const zones = [_activeZone('fz1')]; // Nguyễn Hữu Cảnh, 45cm > wade limit
    const routes = findMultipleRoutes('n1', 'n12', zones, vehicleConfig);
    TestRunner.assert.isTrue(!routes.safest.error, 'an alternative safe route should exist');
    // The safest route must not traverse any unsafe flooded edge.
    const hasUnsafe = routes.safest.floodWarnings.some(w => w.unsafeForEv);
    TestRunner.assert.isFalse(hasUnsafe, 'safest route should not cross unsafe flood');
});

TestRunner.test('LocalEngine: no safe route when only path is flooded', () => {
    const zones = [_activeZone('fz1')]; // blocks e7 (n3->n10), the only way into n10
    const routes = findMultipleRoutes('n3', 'n10', zones, vehicleConfig);
    TestRunner.assert.equal(routes.safest.error, 'NO_SAFE_ROUTE');
    // Faster modes may still squeeze through (passable but penalised).
    TestRunner.assert.isTrue(!routes.fastest.error, 'fastest mode may still pass flooded edge');
});

TestRunner.test('LocalEngine: invalid nodes return INVALID_NODES', () => {
    const routes = findMultipleRoutes('zzz', 'n1', [], vehicleConfig);
    TestRunner.assert.equal(routes.safest.error, 'INVALID_NODES');
});

TestRunner.test('LocalEngine: rainfall model scales flood depth and activation', () => {
    // Put fz1 in play, then drive depth purely from rainfall.
    floodZones.forEach(fz => { fz._inPlay = (fz.id === 'fz1'); fz._designDepthCm = fz._designDepthCm != null ? fz._designDepthCm : fz.depthCm; });

    const fz1 = floodZones.find(z => z.id === 'fz1');

    applyRainfallToFloodZones(0);
    const dryDepth = fz1.depthCm;
    TestRunner.assert.isFalse(fz1.isActive, 'no rain -> not active');

    applyRainfallToFloodZones(120);
    TestRunner.assert.isTrue(fz1.isActive, 'heavy rain -> active');
    TestRunner.assert.isTrue(fz1.depthCm > dryDepth, 'depth grows with rainfall');

    // Clean up global state for other suites.
    floodZones.forEach(fz => { fz._inPlay = false; applyRainfallToFloodZones(0); });
});
