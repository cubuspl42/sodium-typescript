import { Set } from 'typescript-collections';

export type Tracer = (gcNode: GcNode) => void;

export type Trace = (tracer: Tracer) => void;

let NEXT_ID: number = 0;
let ROOTS: Set<GcNode> = new Set<GcNode>(node => "" + node.id);
let TO_BE_FREED: Set<GcNode> = new Set<GcNode>(node => "" + node.id);

enum Color {
    Black,
    Gray,
    Purple,
    White
}

export class GcNode {
    private _id: number;
    public refCount: number = 0;
    public color: Color = Color.Black;
    public buffered: boolean = false;
    private _constructor: ()=>void;
    private _destructor: ()=>void;
    private _trace: Trace;

    public id(): number {
        return this._id;
    }

    public constructor(
        constructor_: ()=>void,
        destructor: ()=>void,
        trace: Trace
    ) {
        this._id = NEXT_ID++;
        this._constructor = constructor_;
        this._destructor = destructor;
        this._trace = trace;
    }

    public incRef(): void {
        ++this.refCount;
        if (this.refCount == 1) {
            (this._constructor)();
        }
    }

    public decRef(): void {
        --this.refCount;
        if (this.refCount == 0) {
            this.free();
        } else {
            this.color = Color.Purple;
            ROOTS.add(this);
        }
    }

    public free(): void {
        (this._destructor)();
    }

    public trace(tracer: Tracer) {
        (this._trace)(tracer);
    }
}

export function collectCycles(): void {
    markRoots();
    scanRoots();
    collectRoots();
}

function markRoots(): void {
    let oldRoots: Set<GcNode> = ROOTS;
    ROOTS = new Set<GcNode>(node => "" + node.id);
    oldRoots.forEach(root => {
        if (root.color == Color.Purple) {
            markGray(root);
            ROOTS.add(root);
        } else {
            root.buffered = false;
            if (root.color == Color.Black && root.refCount == 0) {
                TO_BE_FREED.add(root);
            }
        }
    });
}

function markGray(node: GcNode): void {
    if (node.color == Color.Gray) {
        return;
    }

    node.color = Color.Gray;

    node.trace(t => {
        t.refCount =  t.refCount - 1;
        markGray(t);
    });
}

function scanRoots(): void {
    ROOTS.forEach(root => {
        scan(root);
    });
}

function scan(s: GcNode): void {
    if (s.color != Color.Gray) {
        return;
    }

    if (s.refCount > 0) {
        scanBlack(s);
    } else {
        s.color = Color.White;
        s.trace(t => {
            scan(t);
        });
    }
}

function scanBlack(s: GcNode): void {
    s.color = Color.Black;
    s.trace(t => {
        t.refCount = t.refCount + 1;
        if (t.color != Color.Black) {
            scanBlack(t);
        }
    });
}

function collectRoots(): void {
    let white = new Set<GcNode>(node => "" + node.id);
    ROOTS.forEach(root => {
        root.buffered = false;
        collectWhite(root, white);
    });
    ROOTS.clear();
    white.forEach(i => {
        i.free();
    });
    TO_BE_FREED.forEach(i => {
        i.free();
    });
    TO_BE_FREED.clear();
}

function collectWhite(s: GcNode, white: Set<GcNode>): void {
    if (s.color == Color.White && !s.buffered) {
        s.color = Color.Black;
        s.trace(t => {
            collectWhite(t, white);
        });
        s.refCount = s.refCount + 1;
        white.add(s);
    }
}
