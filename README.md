# benchmark

[![npm Version](https://badge.fury.io/js/benchmark-util.png)](https://npmjs.org/package/benchmark-util)

This is a small utility that supports:
* Benchmarks
* `async` functions (on top of simple synchronous functions)
* `.abort()` in order to, well, abort!
* Defining multiple units to benchmark (`.add(name, function)`)
* Defining prepare and teardown callbacks (`.add(name, { prepare, unit, teardown })`)
* Decide how you want to present the results on your own
* Do a warmup run before running benchmarks for each unit (`.setWarmupTime(milliseconds)`)
* Set up time for benchmarking each unit (`.setMaxUnitTime(milliseconds)`) 
* Set up how many runs to do for each unit, which is useful for detecting deviations and unstable behavior (`.setRunsPerUnit(runs)`)
* `await benchmark.run(options)` for compatibility with modern `await` syntax or `.then`/`.catch`
* There are JSDocs for everything, which should make intellisense much easier and stricter.

## Installation:

```
npm i benchmark-util
```
  
## Usage example:

```javascript
(async () => {
    const Benchmark = require('benchmark-util');
    
    let bench = new Benchmark();
    
    bench
        .add(`Test performance of tiger`, () => {
            /running tiger/.test('Find a running tiger in this string');
        })
        .add(`Test performance of async tigers`, (() => {
            async function lookForRunningTiger() {
                return /running tiger/.test('Find a running tiger in this string');
            }
            
            return async () => {
                await lookForRunningTiger();
            };
        })())
        .add(`Test performance of async tigers with Promise`, async () => {
            await new Promise(resolve => {
                resolve(/running tiger/.test('Find a running tiger in this string'));
            });
        })
        .add(`Test with prepare & teardown`, {
            prepare: () => console.log('This is me preparing'),
            unit: () => {
                /running tiger/.test('Find a running tiger in this string');
            },
            teardown: () => console.log('This is me tearing it down'),
        });
    
    let results = await bench.run({
        onCycle: ({ name, totals, samples, warmup }) => {
            console.log(`${name} x ${Math.round(totals.avg)} ops/sec ± ${Math.round((totals.stdDev / totals.avg) * 10000) / 100}% (${totals.runs} runs sampled)`);
        }
    });
    
    let fastest = results.sort((a, b) => a.totals.avg > b.totals.avg ? -1 : a.totals.avg < b.totals.avg ? 1 : 0)[0].name;
    
    console.log(`Fastest is: ${fastest}`);
})();

```

## Contributing

I welcome contributions of any kind.

## Me
* Hi! I am Daniel.
* danielgindi@gmail.com is my email address.
* That's all you need to know.

## Help

If you want to buy me a beer, you are very welcome to
[![Donate](https://www.paypalobjects.com/en_US/i/btn/btn_donate_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=G6CELS3E997ZE)
 Thanks :-)

## License

All the code here is under MIT license. Which means you could do virtually anything with the code.
I will appreciate it very much if you keep an attribution where appropriate.

    The MIT License (MIT)

    Copyright (c) 2013 Daniel Cohen Gindi (danielgindi@gmail.com)

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.