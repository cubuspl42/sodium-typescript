import { Cell } from "./Cell";
import { Transaction } from "./Transaction";
import { CellSinkVertex } from "./Vertex";

/**
 * A cell that allows values to be pushed into it, acting as an interface between the
 * world of I/O and the world of FRP. Code that exports CellSinks for read-only use
 * should downcast to {@link Cell}.
 */
export class CellSink<A> extends Cell<A> {
    /**
     * Construct a writable cell with the specified initial value. If multiple values are
     * sent in the same transaction, the specified function is used to combine them.
     *
     * If the function is not supplied, then an exception will be thrown in this case.
     */
    constructor(initValue: A, f?: (l: A, r: A) => A) {
        super(undefined, undefined, new CellSinkVertex<A>());
    }

    /**
     * Send a value, modifying the value of the cell. send(A) may not be used inside
     * handlers registered with {@link Stream#listen(Handler)} or {@link Cell#listen(Handler)}.
     * An exception will be thrown, because CellSink is for interfacing I/O to FRP only.
     * You are not meant to use this to define your own primitives.
     * @param a Value to push into the cell.
     */
    send(a: A): void {
        Transaction.run((t) => {
            const vertex = this._vertex as CellSinkVertex<A>;
            vertex.fire(a);
            vertex.processed = true;
            t.addRoot(vertex);
        });
    }
}
