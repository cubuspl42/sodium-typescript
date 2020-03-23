/**
 * @jest-environment node
 */

import {
    CellSink,
    Transaction
} from '../../lib/Lib';
import * as Benchmark from 'benchmark';

function simpleTest() {
    const sink = new CellSink<number>(2);
    const mapped = Transaction.run(() => [...Array(2500).keys()].map((i) => sink.map((a) => a * i)));
    mapped.forEach((m) => m.listen(() => { }));
    sink.send(2);
}

const suite = new Benchmark.Suite;

test('simple performance test', (done) => {
    suite
        .add('simple', function () {
            simpleTest();
        })
        .on('cycle', function (event) {
            const benchmark = event.target as Benchmark;
            const mean = benchmark.stats.mean * 1000;
            console.log(String(benchmark) + "\n" + `[mean time ${mean.toFixed(2)} ms/op]`);
        })
        .run();
    done();
});
