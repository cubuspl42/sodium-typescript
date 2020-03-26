/**
 * @jest-environment node
 */

import {
    CellSink,
    Transaction,
    Cell,
    lambda1
} from '../../lib/Lib';
import * as Benchmark from 'benchmark';

const suite = new Benchmark.Suite;

function range(n: number) {
  return  Array.from(Array(n).keys());
}

function performanceTest(f: () => void) {
    suite
        .add('simple', function () {
            f();
        })
        .on('cycle', function (event) {
            const benchmark = event.target as Benchmark;
            const mean = benchmark.stats.mean * 1000;
            console.log(String(benchmark) + "\n" + `[mean time ${mean.toFixed(2)} ms/op]`);
        })
        .run();
}

test('should test mapC performance', (done) => {
    performanceTest(() => {
        const sink = new CellSink<number>(2);
        const mapped = Transaction.run(() => range(2500).map((i) => sink.map((a) => a * i)));
        const terminal = Cell.liftArray(mapped).map((arr) => arr.reduce((a, b) => Math.max(a, b)));
        terminal.listen(() => { });
        sink.send(2);
    });
    done();
});

test('should test switchC performance', (done) => {
    interface X {
        readonly c: Cell<number>;
    }

    performanceTest(() => {
        const ca = new CellSink<number>(1);
        const cb = new CellSink<number>(2);
        const csw = new CellSink<string>("ca");
        const cc = csw.map(lambda1((sw) => sw === "ca" ? { c: ca } : { c: cb }, [ca, cb]));

        const mapped = range(500).map((i) => Cell.switchC(cc.map(x => x.c)).map(a => a * i));
        const terminal = Cell.liftArray(mapped).map((arr) => arr.reduce((a, b) => Math.max(a, b)));
        terminal.listen(() => { });

        Transaction.run(() => {
            ca.send(11);
            cb.send(22);
            csw.send("cb");
        });
    });
    done();
});
