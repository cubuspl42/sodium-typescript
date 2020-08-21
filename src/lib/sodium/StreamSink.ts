import { Stream } from "./Stream";
import { Transaction } from "./Transaction";
import { StreamSinkVertex } from './Vertex';

/**
 * A stream that allows values to be pushed into it, acting as an interface between the
 * world of I/O and the world of FRP. Code that exports StreamSinks for read-only use
 * should downcast to {@link Stream}.
 */
export class StreamSink<A> extends Stream<A> {
    constructor(f?: (l: A, r: A) => A) {
        super(new StreamSinkVertex());
    }

    send(a: A): void {
        Transaction.run((t) => {
            const vertex = this.vertex as StreamSinkVertex<A>;
            vertex.fire(a);
            t.addRoot(vertex);
        });
    }
}
