/**
 * test-runner.js
 * A minimal, dependency-free test runner for browser-based TDD.
 */

const TestRunner = {
    tests: [],
    
    test(name, fn) {
        this.tests.push({ name, fn });
    },
    
    assert: {
        equal(actual, expected, message) {
            if (actual !== expected) {
                throw new Error(message || `Expected ${expected} but got ${actual}`);
            }
        },
        
        deepEqual(actual, expected, message) {
            const actualStr = JSON.stringify(actual);
            const expectedStr = JSON.stringify(expected);
            if (actualStr !== expectedStr) {
                throw new Error(message || `Expected ${expectedStr} but got ${actualStr}`);
            }
        },

        isTrue(actual, message) {
            if (actual !== true) {
                throw new Error(message || `Expected true but got ${actual}`);
            }
        },

        isFalse(actual, message) {
            if (actual !== false) {
                throw new Error(message || `Expected false but got ${actual}`);
            }
        }
    },
    
    async run() {
        console.log(`%c[TestRunner] Running ${this.tests.length} tests...`, 'color: blue; font-weight: bold;');
        let passed = 0;
        let failed = 0;
        
        for (const t of this.tests) {
            try {
                await t.fn();
                console.log(`%c✅ PASS: ${t.name}`, 'color: green;');
                passed++;
            } catch (error) {
                console.error(`%c❌ FAIL: ${t.name}\n   ${error.message}`, 'color: red;');
                failed++;
            }
        }
        
        console.log(`%c[TestRunner] Results: ${passed} passed, ${failed} failed.`, `color: ${failed > 0 ? 'red' : 'green'}; font-weight: bold;`);
        
        // Expose to UI if container exists
        const container = document.getElementById('test-results');
        if (container) {
            container.innerHTML = `
                <div style="margin: 20px; font-family: monospace;">
                    <h2>Test Results</h2>
                    <p style="color: ${failed > 0 ? 'red' : 'green'}; font-weight: bold;">
                        ${passed} passed, ${failed} failed.
                    </p>
                </div>
            `;
        }
    }
};
