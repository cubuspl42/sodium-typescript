import { Vertex } from './Vertex';

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

function _visit(set: Set_<Vertex>, vertex: Vertex): void {
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

    private roots = new Set<Vertex>();

    private static visited = new Set_<Vertex>();

    private postQueue: Array<() => void> = [];

    constructor() {
    }

    addRoot(root: Vertex) {
        this.roots.add(root);
    }

    visit(v: Vertex): void {
        _visit(Transaction.visited, v);
    }

    postEnqueue(h: () => void): void {
        this.postQueue.push(h);
    }

    close(): void {
        // TODO: Handle in-transaction errors!
        const dfs = (roots: Set<Vertex>): Set_<Vertex> => {
            roots.forEach((v) => {
                this.visit(v);
            });
            return Transaction.visited;
        }

        const visited = dfs(this.roots);

        Transaction.visitedVerticesCount = Math.max(visited.size, Transaction.visitedVerticesCount);

        this.roots.clear();

        visited.forEach((v) => {
            v.process(this);
            //  v.postprocess(); (can it be called here?)
        });

        visited.forEach((v) => {
            v.postprocess();
        });

        this.postQueue.forEach((h) => h());

        visited.forEach((l) => l.update());

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
        Transaction.currentTransaction!.postEnqueue(h);
    }
}
