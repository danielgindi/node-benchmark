function isPromise(obj) {
  if (obj instanceof Promise) return true;
  return (obj !== null && typeof obj === 'object' || typeof obj === 'function') &&
    typeof obj.then === 'function';
}

function abortError(message) {
    let err = new Error(message);
    err.name = 'AbortError';
    return err;
}

/**
 * @typedef {Object} BenchmarkResults
 * @property {string} name
 * @property {{runs: number, avg: number, stdDev: number}} totals
 * @property {{duration: number, hits: number}[]} samples
 * @property {{duration: number, hits: number}|undefined} warmup
 */
/** */

class Benchmark {

    constructor() {
        this._p = {
            units: [],
            aborted: false,
            warmupTime: 50,
            maxUnitTime: 5000,
            runsPerUnit: 10,
        };
    }

    /**
     * @param {string} name
     * @param {function|options} options - pass options, or a unit function
     * @param {function} options.prepare - function for preparing before running the benchmark for this unit
     * @param {function} options.unit - function for running in the unit
     * @param {function} options.teardown - function for preparing before running the benchmark for this unit
     * @returns {Benchmark} this
     */
    add(name, options) {
        const p = this._p;

        p.units.push({
            name: name,
            prepare: options ? options.prepare : null,
            unit: typeof options === 'function' ? options : options.unit,
            teardown: options ? options.teardown : null,
        });

        return this;
    }
    
    /**
     * Aborts the run as soon as possible.
     * If `run` is in progress, it will throw an `AbortError`.
     * It may take a while to abort, while the longest time it would take is the duration of a single run (`maxUnitTime / runsPerUnit`)
     * @returns {Benchmark} this
     */
    abort() {
        this._p.aborted = true;
        return this;
    }

    /**
     * Warmup time to spend on each unit.
     * This does not count against the `maxUnitTime`.
     * @param {number} ms - milliseconds
     * @default 50
     * @returns {Benchmark} this
     */
    setWarmupTime(ms) {
        this._p.warmupTime = ms;
        return this;
    }

    /**
     * Warmup time to spend on each unit.
     * This does not count against the `maxUnitTime`.
     * @returns {number} milliseconds
     * @default 50
     */
    getWarmupTime() {
        return this._p.warmupTime;
    }

    /**
     * Maximum time spent on each unit.
     * @param {number} ms - milliseconds
     * @default 5000
     * @returns {Benchmark} this
     */
    setMaxUnitTime(ms) {
        this._p.maxUnitTime = ms;
        return this;
    }

    /**
     * Maximum time spent on each unit.
     * @returns {number} milliseconds
     * @default 5000
     */
    getMaxUnitTime() {
        return this._p.maxUnitTime;
    }

    /**
     * How many runs to do on a unit.
     * This splits the time spent on a unit to X parts, and samples them separately.
     * Useful for detecting deviations and unstable behavior (using stdDev)
     * @param {number} runs
     * @default 10
     * @returns {Benchmark} this
     */
    setRunsPerUnit(runs) {
        this._p.runsPerUnit = runs;
        return this;
    }

    /**
     * How many runs to do on a unit.
     * This splits the time spent on a unit to X parts, and samples them separately.
     * Useful for detecting deviations and unstable behavior (using stdDev)
     * @returns {number} runs
     */
    getRunsPerUnit() {
        return this._p.runsPerUnit;
    }

    /**
     * Runs the benchmark suite
     * @param {Object=} options
     * @param {function(BenchmarkResults)=} options.onCycle
     * @returns {BenchmarkResults[]} results
     */
    async run(options) {
        const p = this._p;

        p.aborted = false;
        
        const onCycle = options && options.onCycle;
        let unitResults = [];

        for (let unit of p.units) {
            if (p.aborted === true)
                throw abortError('abort() was called');

            const maxUnitTime = p.maxUnitTime;
            const runsPerUnit = Math.max(p.runsPerUnit, 1);
            const sampleRunTime = maxUnitTime / p.runsPerUnit;

            const hasWarmupRun = p.warmupTime > 0;
            let actualRunCount = hasWarmupRun ? runsPerUnit + 1 : runsPerUnit;

            unit.samples = [];

            let unitPrepareFn = unit.prepare;
            let unitFn = unit.unit;
            let unitTeardownFn = unit.teardown;

            const doRun = async () => {
                let startTime = Date.now();
                let endTime = startTime + sampleRunTime;
                let hits = 0;

                while (p.aborted !== true) {
                    let res = unitFn();

                    if (fnIsPromise) {
                        await res;
                    }

                    hits++;

                    let now = Date.now();

                    if (now >= endTime) {
                        unit.samples.push({
                            hits: hits,
                            duration: now - startTime,
                        });

                        hits = 0;
                        break;
                    }
                }
            };

            if (typeof unitPrepareFn === 'function')
                await unitPrepareFn();

            // Run once to detect if it's an async function.
            // Do not load the isPromise detection over the unit sampling time.
            let fnIsPromise = isPromise(unitFn());

            for (let run = 0; run < actualRunCount; run++) {
                // Give a chance for abort() to take place between runs

                if (p.aborted === true)
                    throw abortError('abort() was called');

                await new Promise((resolve, reject) => {
                    setTimeout(() => {
                        doRun().then(resolve).catch(reject);
                    }, 0);
                });
            }

            if (typeof unitTeardownFn === 'function')
                await unitTeardownFn();

            if (hasWarmupRun && unit.samples.length > 0) {
                unit.warmup = unit.samples.shift();
            }

            let runs = unit.samples.length;
            let avg = unit.samples.reduce((s, v) => s + v.hits, 0) / runs;
            let stdDev = Math.sqrt(
                unit.samples
                    .map(v => Math.pow(v.hits - avg, 2))
                    .reduce((s, v) => s + v, 0) / runs
            );

            if (p.aborted === true)
                throw abortError('abort() was called');

            const toPerSec = function(count) {
                return count * (1000 / sampleRunTime);
            };

            // Set final results
            /** @type BenchmarkResults */
            let results = {
                name: unit.name,
                totals: {
                    runs: runs,
                    avg: toPerSec(avg),
                    stdDev: toPerSec(stdDev),
                },
                samples: unit.samples,
            };

            if (unit.warmup) {
                results.warmup = unit.warmup;
            }
            unitResults.push(results);

            // Callback
            onCycle && onCycle(results);
        }

        return unitResults;
    }
}

// Let's support browsers also, as it does not cost us much

if (typeof module !== 'undefined') {
    /** @type {typeof Benchmark} */
    module.exports = Benchmark;
}
else if (typeof window !== 'undefined') { // eslint-disable-line no-undef
    /** @type {typeof Benchmark} */
    window.Benchmark = Benchmark; // eslint-disable-line no-undef
}
else if (typeof define === 'function' && define.amd) { // eslint-disable-line no-undef
    /** @type {typeof Benchmark} */
    define(() => Benchmark); // eslint-disable-line no-undef
}
