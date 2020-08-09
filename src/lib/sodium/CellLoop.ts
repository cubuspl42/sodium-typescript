import { Cell } from "./Cell";
import { Lazy } from "./Lazy";
import { Transaction } from "./Transaction";
import { StreamLoop } from "./Stream";
import { CellVertex } from "./Vertex";

class CellLoopVertex<A> extends CellVertex<A> {
    private source?: CellVertex<A>;

    constructor() {
        super(false);
        if (Transaction.currentTransaction === null)
            throw new Error("StreamLoop/CellLoop must be used within an explicit transaction");
    }

    initialize(): void {
        if (this.source !== undefined) {
            this.source.addDependent(this);
            // this._oldValue = this.source.oldValue;
        }
    }

    uninitialize(): void {
        this.source.removeDependent(this);
    }

    buildOldValue(): A {
        const source = this.source;
        if (source === undefined) {
            throw new Error("CellLoop hasn't been looped yet");
        }
        return source.oldValue;
    }

    buildNewValue(): A {
        const source = this.source;
        if (source === undefined) {
            throw new Error("CellLoop hasn't been looped yet");
        }
        return source.newValue;
    }

    loop(source: CellVertex<A>): void {
        if (this.source !== undefined)
            throw new Error("CellLoop looped more than once");

        this.source = source;

        if (this.refCount() > 0) {
            source.addDependent(this);
        }

        // This doesn't really work yet (birth-transaction aliveness issue)
        if (source.visited) {
            Transaction.currentTransaction.visit(this);
        }
    }
}

/**
 * A forward reference for a {@link Cell} equivalent to the Cell that is referenced.
 */
export class CellLoop<A> extends Cell<A> {
    constructor() {
        super(undefined, undefined, new CellLoopVertex());
    }

    /**
     * Resolve the loop to specify what the CellLoop was a forward reference to. It
     * must be invoked inside the same transaction as the place where the CellLoop is used.
     * This requires you to create an explicit transaction with {@link Transaction#run(Lambda0)}
     * or {@link Transaction#runVoid(Runnable)}.
     */
    loop(a_out: Cell<A>): void {
        (this.vertex as CellLoopVertex<A>).loop(a_out.vertex);
    }
}
