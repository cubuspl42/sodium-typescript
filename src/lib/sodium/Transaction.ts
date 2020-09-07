import { _Vertex, StreamVertex } from './Vertex';

let enableDebugFlag = false;

function log(a: any): void {
    if (enableDebugFlag) {
        console.log(a);
    }
}

class Set_<A> {
    private readonly array: Array<A | undefined> = [];

    private _size = 0;

    get size(): number {
        return this._size;
    }

    add(a: A): void {
        if (this._size < this.array.length) {
            this.array[this._size] = a;
            this._size++;
        } else {
            this.array.push(a);
            this._size = this.array.length;
        }
    }

    forEach(f: (a: A) => void) {
        const array = this.array;
        const size = this.size;

        for (let i = 0; i < size; ++i) {
            f(array[i]!);
        }
    }

    clear(): void {
        const array = this.array;
        const size = this.size;

        for (let i = 0; i < size; ++i) {
            array[i] = undefined;
        }

        this._size = 0;
    }
}

function _visit(set: Set_<_Vertex>, vertex: _Vertex): void {
    if (vertex.visitedRaw) return;

    vertex.markVisited();

    vertex.dependents?.forEach((v) => {
        _visit(set, v);
    });

    set.add(vertex);
}

let nextId = 0;

export class Transaction {
    readonly id = ++nextId;

    private roots = new Set<_Vertex>();

    private static visited = new Set_<_Vertex>();

    private effectQueue: Array<() => void> = [];

    private updateQueue: Array<() => void> = [];

    private resetQueue: Array<() => void> = [];

    constructor() {
    }

    addRoot(root: _Vertex) {
        this.roots.add(root);
    }

    visit(v: _Vertex): void {
        _visit(Transaction.visited, v);
    }

    effectEnqueue(h: () => void): void {
        this.effectQueue.push(h);
    }

    updateEnqueue(h: () => void): void {
        this.updateQueue.push(h);
    }

    resetEnqueue(h: () => void): void {
        this.resetQueue.push(h);
    }

    close(): void {
        // TODO: Handle in-transaction errors!
        const dfs = (roots: Set<_Vertex>): Set_<_Vertex> => {
            roots.forEach((v) => {
                this.visit(v);
            });
            return Transaction.visited;
        }

        const vertexAll = _Vertex.all;

        const vNewValue = _Vertex.all.find((v) => v instanceof StreamVertex && v.hasNewValue);
        if (vNewValue !== undefined) {
            throw new Error("Some vertices have new value at the start of transaction");
        }

        const visited = dfs(this.roots);

        Transaction.visitedVerticesCount = Math.max(visited.size, Transaction.visitedVerticesCount);

        this.roots.clear();

        visited.forEach((v) => {
            v.process(this);
        });

        while (this.effectQueue.length > 0) {
            const h = this.effectQueue.shift();
            h();
        }

        while (this.updateQueue.length > 0) {
            const h = this.updateQueue.shift();
            h();
        }

        while (this.resetQueue.length > 0) {
            const h = this.resetQueue.shift();
            h();
        }

        Transaction.visited.clear();

        // Sodium order:
        // event processing
        // cell value update
        // listeners
    }

    static visitedVerticesCount = 0;

    static currentTransaction?: Transaction;

    static enableDebug(flag: boolean) {
        enableDebugFlag = flag;
    }

    static log(msg: () => any): void {
        if (enableDebugFlag) {
            console.log(msg());
        }
    }

    public static run<A>(f: (t: Transaction) => A): A {
        const ct = this.currentTransaction;

        if (!ct) {
            log(`Transaction start`);

            const vVisited = _Vertex.all.find((v) => v.visitedRaw);
            if (vVisited !== undefined) {
                throw new Error("Some vertices are visited at the start of transaction");
            }

            const t = new Transaction();

            this.currentTransaction = t;

            try {
                const a = f(t);

                t.close();

                return a;
            } finally {
                this.currentTransaction = undefined;

                log(`Transaction end`);
            }
        } else {
            return f(ct);
        }
    }

    public static post<A>(h: () => void): void {
        Transaction.currentTransaction!.effectEnqueue(h);
    }
}
