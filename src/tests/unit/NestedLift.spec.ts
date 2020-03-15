
import {
    StreamSink,
    CellSink,
    Transaction,
    Tuple2,
    Operational,
    Cell,
    CellLoop,
    getTotalRegistrations,
} from '../../lib/Lib';

function lambda1<A, B>(f: (a: A) => B, deps?: any[]): (a: A) => B {
    return f;
}

afterEach(() => {
    if (getTotalRegistrations() != 0) {
        throw new Error('listeners were not deregistered');
    }
});

test('map + nested lift', (done) => {
    const out = new Array<number>();
    const ccOriginal = new Cell<Cell<number>>(new Cell(1));
    const sOffset = new StreamSink<number>();
    const cOffset = sOffset.hold(0);

    const cTotal = ccOriginal.map(cOriginal =>
        cOriginal.lift(cOffset, (value, offset) => value + offset)
    );

    const kill = Cell
        .switchC(cTotal)
        .listen(value => {
            out.push(value);

            if (out.length === 2) {
                done();
            }
        });

    sOffset.send(2);
    sOffset.send(4);
    kill();

    expect(out).toEqual([1, 3, 5]);
});


test('lift + nested data/map', (done) => {
    interface Data {
        cValue: Cell<number>;
    }
    const out = new Array<number>();
    const cOriginal = new Cell<Data>({ cValue: new Cell(1) });
    const sOffset = new StreamSink<number>();
    const cOffset = sOffset.hold(0);

    const cTotal = cOriginal.lift(cOffset, (data, offset) => {
        return {
            cValue: data.cValue.map(value => value + offset)
        }
    })


    const kill = Cell
        .switchC(cTotal.map(data => data.cValue))
        .listen(value => {
            out.push(value);

            if (out.length === 2) {
                done();
            }
        });

    sOffset.send(2);
    sOffset.send(4);
    kill();

    expect(out).toEqual([1, 3, 5]);
});

test('map + nested data/lift (w/ Transaction)', (done) => {
    interface Data {
        cValue: Cell<number>;
    }

    const out = new Array<number>();
    const cOriginal = new Cell<Data>({ cValue: new Cell(1) });
    const sOffset = new StreamSink<number>();
    const cOffset = sOffset.hold(0);

    const cTotal = cOriginal.map(lambda1((data: Data) => {
        return {
            cValue: data.cValue.lift(cOffset, (value, offset) => value + offset)
        }
    }, [cOffset]));

    const kill = Transaction.run(() =>
        Cell.switchC(cTotal.map(data => data.cValue))
            .listen(value => {
                out.push(value);
                if (out.length === 2) {
                    done();
                }
            })
    );


    sOffset.send(2);
    sOffset.send(4);

    kill();

    expect(out).toEqual([1, 3, 5]);

});

test('map + nested data/lift (no Transaction)', (done) => {
    interface Data {
        cValue: Cell<number>;
    }

    const out = new Array<number>();
    const cOriginal = new Cell<Data>({ cValue: new Cell(1) });
    const sOffset = new StreamSink<number>();
    const cOffset = sOffset.hold(0);

    const cTotal = cOriginal.map(lambda1((data: Data) => {
        return {
            cValue: data.cValue.lift(cOffset, (value, offset) => value + offset)
        }
    }, [cOffset]));

    const kill = Cell
        .switchC(cTotal.map(data => data.cValue))
        .listen(value => {
            out.push(value);
            if (out.length === 2) {
                done();
            }
        })


    sOffset.send(2);
    sOffset.send(4);

    kill();

    expect(out).toEqual([1, 3, 5]);

});
