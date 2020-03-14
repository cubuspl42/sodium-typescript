import {
    Lambda1, Lambda1_deps, Lambda1_toFunction,
    Lambda2, Lambda2_deps, Lambda2_toFunction
} from "./Lambda";
import { Stream } from "./Stream";
import { CoalesceHandler } from "./CoalesceHandler";
import { Transaction } from "./Transaction";
import { Vertex_, StreamVertex } from './Vertex';

// class StreamSinkVertex<A> extends StreamVertex<A> {
//     constructor(
//     ) {
//         super()
//     }

//     process(): void {
//     }
// }

/**
 * A stream that allows values to be pushed into it, acting as an interface between the
 * world of I/O and the world of FRP. Code that exports StreamSinks for read-only use
 * should downcast to {@link Stream}.
 */
export class StreamSink<A> extends Stream<A> {
    private disableListenCheck: boolean = false;

    constructor(f?: ((l: A, r: A) => A) | Lambda2<A, A, A>) {
        super(new StreamVertex());
    }

    private coalescer: CoalesceHandler<A>;

    send(a: A): void {
        Transaction.run((t) => {
            const vertex = this.vertex;
            vertex.fire(a);
            t.addRoot(vertex);
        });
    }

    listen_(target: Vertex_,
        h: (a: A) => void,
        suppressEarlierFirings: boolean): () => void {
        return () => { };
    }
}
