let totalRegistrations: number = 0;
export function getTotalRegistrations(): number {
    return totalRegistrations;
}

export abstract class Vertex {
    readonly dependents?: Set<Vertex>;

    visited = false;

    abstract process(): void;

    reset(): void {
        this.visited = false;
    }

    refCount(): number {
        return 0;
    }
}

export class StreamVertex<A> extends Vertex {
    readonly dependents = new Set<Vertex>();

    newValue?: A;

    visited = false;

    fire(a: A) {
        this.newValue = a;
    }

    process(): void { }

    reset(): void {
        this.visited = false;
        this.newValue = undefined;
    }

    addDependent(vertex: Vertex): void {
        this.dependents.add(vertex);
    }
}


export class CellVertex<A> extends StreamVertex<A> {
    _oldValue?: A;

    get oldValue(): A {
        if (this._oldValue === undefined) {
            this._oldValue = this.buildValue();
        }
        return this._oldValue;
    }

    constructor(initValue?: A, newValue?: A) {
        super();
        this._oldValue = initValue;
        this.newValue = newValue;
    }

    buildValue(): A {
        throw new Error("Unimplemented");
    }

    reset() {
        this._oldValue = this.newValue || this.oldValue;
        super.reset();
    }
}

export class ListenerVertex<A> extends Vertex {
    readonly source: StreamVertex<A>;

    private readonly h: (a: A) => void;

    constructor(
        source: StreamVertex<A>,
        h: (a: A) => void,
    ) {
        super();

        this.source = source;
        this.h = h;

        source.addDependent(this);
    }

    process() {
        const a = this.source.newValue;
        if (!!a) {
            this.h(a);
        }
    }
}
