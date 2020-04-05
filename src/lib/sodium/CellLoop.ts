import { Cell } from "./Cell";
import { Lazy } from "./Lazy";
import { Transaction } from "./Transaction";
import { StreamLoop } from "./Stream";
import { CellVertex } from "./Vertex";

class CellLoopVertex<A> extends CellVertex<A> {
    isLooped = false;

    private source?: CellVertex<A>;

    constructor() {
        super();
        if (Transaction.currentTransaction === null)
            throw new Error("StreamLoop/CellLoop must be used within an explicit transaction");
    }

    initialize(): void {
        if (this.source === undefined)
            throw new Error(`Attempted to initalize a CellLoop before it was looped`);

        this.source.addDependent(this);
        this._oldValue = this.source!.oldValue;
    }

    uninitialize(): void {
        this.source.removeDependent(this);
    }

    buildNewValue(): A {
        return this.source!.newValue;
    }

    loop(source: CellVertex<A>): void {
        if (this.isLooped)
            throw new Error("CellLoop looped more than once");

        this.source = source;
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
