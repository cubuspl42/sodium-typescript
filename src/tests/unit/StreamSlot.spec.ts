import { getTotalRegistrations, Stream, StreamSink, StreamSlot, Transaction, Unit } from '../../lib/Lib';

afterEach(() => {
    if (getTotalRegistrations() != 0) {
        throw new Error('listeners were not deregistered');
    }
});

test('connect to a StreamSlot', (done) => {
    const streamSlot = new StreamSlot<number>();
    const out: number[] = [];

    const kill = streamSlot.listen(a => {
        out.push(a);
        done();
    });

    const sink = new StreamSink<number>();

    streamSlot.connect(sink, {
        sDisconnect: new Stream(),
    });

    sink.send(11);

    expect(out).toEqual([11]);

    kill();
});

test('connect to StreamSlot with a currently emitting Stream', (done) => {
    const streamSlot = new StreamSlot<number>();
    const out: number[] = [];

    const kill = streamSlot.listen(a => {
        out.push(a);
    });

    Transaction.run(() => {
        const sink = new StreamSink<number>();
        sink.send(11);
        streamSlot.connect(sink, {
            sDisconnect: new Stream(),
        });
    });

    expect(out).toEqual([]);

    kill();
    done();
});

test('disconnect from a StreamSlot', (done) => {
    const streamSlot = new StreamSlot<number>();
    const out: number[] = [];

    const kill = streamSlot.listen(a => {
        out.push(a);
        done();
    });

    const sink1 = new StreamSink<number>();
    const sink2 = new StreamSink<number>();
    const sink3 = new StreamSink<number>();
    const s = sink1.orElse(sink2).orElse(sink3);
    const sDisconnect = sink2.mapTo(Unit.UNIT);

    streamSlot.connect(s, {
        sDisconnect: sDisconnect,
    });

    expect(s._vertex.refCount()).toEqual(1);
    expect(sDisconnect._vertex.refCount()).toEqual(1);

    sink1.send(11);
    sink2.send(22);

    expect(s._vertex.refCount()).toEqual(0);
    expect(sDisconnect._vertex.refCount()).toEqual(0);

    sink3.send(33);

    expect(out).toEqual([11, 22]);

    kill();
});
