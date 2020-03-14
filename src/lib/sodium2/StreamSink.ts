import {
    Lambda1, Lambda1_deps, Lambda1_toFunction,
    Lambda2, Lambda2_deps, Lambda2_toFunction
} from "./Lambda";
import { StreamWithSend } from "./Stream";
import { CoalesceHandler } from "./CoalesceHandler";
import { Transaction } from "./Transaction";
import { Vertex } from './Vertex';

/**
 * A stream that allows values to be pushed into it, acting as an interface between the
 * world of I/O and the world of FRP. Code that exports StreamSinks for read-only use
 * should downcast to {@link Stream}.
 */
export class StreamSink<A> extends StreamWithSend<A> {
    private disableListenCheck: boolean = false;

    constructor(f?: ((l: A, r: A) => A) | Lambda2<A, A, A>) {
        super();
        throw new Error();
    }

    private coalescer: CoalesceHandler<A>;

    send(a: A): void {
        throw new Error();
    }

    listen_(target: Vertex,
        h: (a: A) => void,
        suppressEarlierFirings: boolean): () => void {
        throw new Error();
    }
}
