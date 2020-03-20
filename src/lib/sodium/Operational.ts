import { Stream } from "./Stream";
import { Cell } from "./Cell";
import { Transaction } from "./Transaction";
import { Unit } from "./Unit";
import { CellVertex, StreamVertex } from "./Vertex";

class ValueVertex<A> extends StreamVertex<A> {
    private isInitialized = false;

    constructor(
        source: CellVertex<A>,
    ) {
        super();

        this.source = source;

        source.addDependent(this);
    }

    readonly source: CellVertex<A>;

    process(): boolean {
        if (!this.isInitialized) {
            this.fire(this.source.oldValue);
            this.isInitialized = true;
        }

        const a = this.source.newValue;
        if (!a) return false;
        this.fire(a);

        return false;
    }
}

export class Operational {
    /**
     * A stream that gives the updates/steps for a {@link Cell}.
     * <P>
     * This is an OPERATIONAL primitive, which is not part of the main Sodium
     * API. It breaks the property of non-detectability of cell steps/updates.
     * The rule with this primitive is that you should only use it in functions
     * that do not allow the caller to detect the cell updates.
     */
    static updates<A>(c: Cell<A>): Stream<A> {
        return new Stream(c.vertex);
    }

    /**
     * A stream that is guaranteed to fire once in the transaction where value() is invoked, giving
     * the current value of the cell, and thereafter behaves like {@link updates(Cell)},
     * firing for each update/step of the cell's value.
     * <P>
     * This is an OPERATIONAL primitive, which is not part of the main Sodium
     * API. It breaks the property of non-detectability of cell steps/updates.
     * The rule with this primitive is that you should only use it in functions
     * that do not allow the caller to detect the cell updates.
     */
    static value<A>(c: Cell<A>): Stream<A> {
        return Transaction.run((t) => {
            const vertex = new ValueVertex(c.vertex);
            t.addRoot(vertex);
            return new Stream(vertex);
        });
    }

	/**
	 * Push each event onto a new transaction guaranteed to come before the next externally
	 * initiated transaction. Same as {@link split(Stream)} but it works on a single value.
	 */
    static defer<A>(s: Stream<A>): Stream<A> {
        throw new Error();
    }

	/**
	 * Push each event in the list onto a newly created transaction guaranteed
	 * to come before the next externally initiated transaction. Note that the semantics
	 * are such that two different invocations of split() can put events into the same
	 * new transaction, so the resulting stream's events could be simultaneous with
	 * events output by split() or {@link defer(Stream)} invoked elsewhere in the code.
	 */
    static split<A>(s: Stream<Array<A>>): Stream<A> {
        throw new Error();
    }
}
