/**
 * test-voice-nlu.js
 * Tests the on-device Vietnamese NLU (the offline fallback that makes VoiceGo
 * robust to speech-to-text errors and works without the backend).
 */

TestRunner.test('NLU: normalizeVi strips Vietnamese accents', () => {
    TestRunner.assert.equal(normalizeVi('Bến Thành'), 'ben thanh');
    TestRunner.assert.equal(normalizeVi('Crescent Mall (D7)'), 'crescent mall d7');
});

TestRunner.test('NLU: resolves an exact destination', () => {
    const u = understandCommand('cho tôi đi Bến Thành');
    TestRunner.assert.equal(u.place.nodeId, 'n1');
    TestRunner.assert.isFalse(u.needsRepeat);
});

TestRunner.test('NLU: recovers from a speech-to-text error (crescen mon)', () => {
    const u = understandCommand('cho tôi đi crescen mon');
    TestRunner.assert.equal(u.place.nodeId, 'n18'); // Crescent Mall
    TestRunner.assert.isFalse(u.needsRepeat);
});

TestRunner.test('NLU: detects car vs bike correctly', () => {
    TestRunner.assert.equal(understandCommand('đặt ô tô đi hàng xanh').vehicle, 'car');
    TestRunner.assert.equal(understandCommand('cho tôi đi hàng xanh').vehicle, 'bike');
});

TestRunner.test('NLU: asks again on unintelligible input', () => {
    const u = understandCommand('abcxyz không rõ ràng gì cả');
    TestRunner.assert.isTrue(u.needsRepeat);
});

TestRunner.test('NLU: price is higher for car than bike on same distance', () => {
    const bike = quotePrice('bike', 5);
    const car = quotePrice('car', 5);
    TestRunner.assert.isTrue(car > bike);
});

TestRunner.test('NLU: snapToNearestNode returns the closest node', () => {
    const benThanh = nodes.find(n => n.id === 'n1');
    const snapped = snapToNearestNode(benThanh.lat + 0.0005, benThanh.lng + 0.0005);
    TestRunner.assert.equal(snapped.id, 'n1');
});
