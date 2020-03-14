import { Cell } from "./Cell";
import { Lazy } from "./Lazy";
import { LazyCell } from "./LazyCell";
import { Transaction } from "./Transaction";
import { StreamLoop } from "./Stream";

/**
 * A forward reference for a {@link Cell} equivalent to the Cell that is referenced.
 */
export class CellLoop<A> extends LazyCell<A> {
    constructor() {
    	super(null, new StreamLoop<A>());
    }

    /**
     * Resolve the loop to specify what the CellLoop was a forward reference to. It
     * must be invoked inside the same transaction as the place where the CellLoop is used.
     * This requires you to create an explicit transaction with {@link Transaction#run(Lambda0)}
     * or {@link Transaction#runVoid(Runnable)}.
     */
    loop(a_out : Cell<A>) : void {
        throw new Error();

    }

    sampleNoTrans__() : A
    {
        throw new Error();
    }
}
