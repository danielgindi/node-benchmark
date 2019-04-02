const assert = require('assert');
const Benchmark = require('../');

describe('Test benchmarks', async () => {

    const doSmallWork = function () {
        let a = 1;
        a *= 2;
        return a /= 2;
    };

    const doLargerWork = function () {
        let str = '';
        for (let i = 0; i < 100; i++) {
            str += i;
        }
        return str;
    };

    const doPromiseWork = (ms) => new Promise(r => setTimeout(r, ms));
    const doAsyncWork = async (ms) => doPromiseWork(ms);

    it(`sample counters`, async () => {

        let bench = new Benchmark();

        await bench
            .add(`doSmallWork`, () => {
                doSmallWork();
            })
            .add(`doLargerWork`, () => {
                doLargerWork();
            })
            .setWarmupTime(10)
            .setMaxUnitTime(1000)
            .setRunsPerUnit(5)
            .run({
                onCycle: function(/**BenchmarkResults*/results) {
                    assert.strictEqual(results.samples.length, 5);

                    for (let sample of results.samples) {
                        assert.ok(sample.duration >= 200, 'Sample duration must be equal to or greater than 10');
                    }

                    assert.ok(results.warmup.duration >= 10, 'Warmup duration must be equal to or greater than 10');
                },
            });
    }).timeout(3000);

    it(`prepare & teardown`, async () => {

        let bench = new Benchmark();

        let prepares = 0;
        let teardown = 0;

        await bench
            .add(`prepare and teardown`, {
                prepare: () => {
                    prepares++;
                },
                unit: () => {
                    assert.strictEqual(prepares, 1);
                    assert.strictEqual(teardown, 0);
                },
                teardown: () => {
                    teardown++;
                },
            })
            .setWarmupTime(10)
            .setMaxUnitTime(200)
            .setRunsPerUnit(10)
            .run({ });

        assert.strictEqual(prepares, 1);
        assert.strictEqual(teardown, 1);

    }).timeout(500);

    it(`async functions`, async () => {

        let bench = new Benchmark();

        let cycleResults = [];

        const SINGLE_TIME = 20;

        let results = await bench
            .add(`doPromiseWork`, () => {
                return doPromiseWork(SINGLE_TIME);
            })
            .add(`doAsyncWork`, async () => {
                await doAsyncWork(SINGLE_TIME);
            })
            .setWarmupTime(10)
            .setMaxUnitTime(1000)
            .setRunsPerUnit(5)
            .run({
                onCycle: function(/**BenchmarkResults*/results) {
                    cycleResults.push(results);

                    for (let sample of results.samples) {
                        assert.ok(
                            sample.hits <= bench.getMaxUnitTime() / bench.getRunsPerUnit() / SINGLE_TIME,
                            `Can't have more hits than ${SINGLE_TIME}ms fits in a single run`);
                    }
                },
            });

        assert.deepStrictEqual(results, cycleResults, 'Results from `run()` must be same as an array of all `onCycle` results');
    }).timeout(3000);

    it(`abort()`, async () => {

        let bench = new Benchmark();

        let promise = bench
            .add(`doSmallWork`, () => {
                doSmallWork();
            })
            .setWarmupTime(10)
            .setMaxUnitTime(1000)
            .setRunsPerUnit(5)
            .run({
                onCycle: function(/**BenchmarkResults*/results) {
                    assert.strictEqual(results.name, 'doSmallWork');
                    assert.strictEqual(results.samples.length, 5);

                    for (let sample of results.samples) {
                        assert.ok(sample.duration >= 200, 'Sample duration must be equal to or greater than 10');
                    }

                    assert.ok(results.warmup.duration >= 10, 'Warmup duration must be equal to or greater than 10');
                },
            });

        setTimeout(() => bench.abort(), 100);

        await promise
            .then(() => {
                throw new Error('Benchmark should have thrown an AbortError');
            })
            .catch(err => {
                assert.strictEqual(err.name, 'AbortError');
            });
    }).timeout(500);

});
