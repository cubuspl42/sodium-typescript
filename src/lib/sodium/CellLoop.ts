import { Cell } from "./Cell";
import { Transaction } from "./Transaction";
import { CellVertex } from "./Vertex";

export interface CellLoopOptions {
    weak: boolean;
}

class CellLoopVertex<A> extends CellVertex<A> {
    private source?: CellVertex<A>;

    private readonly weak: boolean;

    constructor(options: CellLoopOptions) {
        super();
        this.weak = options?.weak ?? false;

        if (Transaction.currentTransaction === null)
            throw new Error("StreamLoop/CellLoop must be used within an explicit transaction");
    }

    initialize(): void {
        if (this.source !== undefined) {
            this.source.addDependent(this, this.weak);
            // this._oldValue = this.source.oldValue;
        }
    }

    uninitialize(): void {
        this.source.removeDependent(this, this.weak);
    }

    buildVisited(): boolean {
        const source = this.source;
        if (source === undefined) {
            throw new Error("CellLoop hasn't been looped yet");
        }
        return source.visited;
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
            source.addDependent(this, this.weak);
        }
    }
}

/**
 * A forward reference for a {@link Cell} equivalent to the Cell that is referenced.
 */
export class CellLoop<A> extends Cell<A> {
    constructor(options?: CellLoopOptions) {
        super(undefined, undefined, new CellLoopVertex(options));
    }

    /**
     * Resolve the loop to specify what the CellLoop was a forward reference to. It
     * must be invoked inside the same transaction as the place where the CellLoop is used.
     * This requires you to create an explicit transaction with {@link Transaction#run(Lambda0)}
     * or {@link Transaction#runVoid(Runnable)}.
     */
    loop(a_out: Cell<A>): void {
        (this._vertex as CellLoopVertex<A>).loop(a_out._vertex);
    }
}
