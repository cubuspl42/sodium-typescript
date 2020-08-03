import { Transaction } from "./Transaction";
import { Stream } from "./Stream";
import { Cell } from "./Cell";

let totalRegistrations: number = 0;

export function getTotalRegistrations(): number {
    return totalRegistrations;
}

export abstract class Vertex {
    private _refCount = 0;

    name?: string;

    readonly dependents?: Set<Vertex>;

    visited = false;

    initialize(): void {
    }

    uninitialize(): void {
    }

    process(): void {
    }

    postprocess(): void {
    }

    update(): void {
        this.visited = false;
    }

    incRefCount(): void {
        ++this._refCount;
        if (this._refCount == 1) {
            this.initialize();
        }
    }

    decRefCount(): void {
        if (this._refCount <= 0) {
            throw new Error("Reference counter is already zero");
        }
        --this._refCount;
        if (this._refCount == 0) {
            this.uninitialize();
        }
    }

    refCount(): number {
        return this._refCount;
    }

    describe(): string {
        return `${this.constructor.name} {name: ${this.name ?? "unnamed"}${this.describe_()}}`;
    }

    describe_(): string {
        return "";
    }
}

export class StreamVertex<A> extends Vertex {
    processed = false;

    readonly dependents = new Set<Vertex>();

    readonly extraDependencies: ReadonlyArray<Vertex>;

    constructor(extraDependencies?: Array<Stream<any> | Cell<any>>) {
        super();
        this.extraDependencies =
            extraDependencies !== undefined ?
                extraDependencies.map((d) => d.vertex) : [];
    }

    initialize(): void {
        this.extraDependencies.forEach((d) => d.incRefCount());
    }

    uninitialize(): void {
        this.extraDependencies.forEach((d) => d.decRefCount());
    }

    _newValue?: A;

    get newValue(): A | undefined {
        if (this._newValue !== undefined) {
            return this._newValue;
        } else if (this.visited && !this.processed) {
            const value = this.buildNewValue();
            this._newValue = value;
            this.processed = true;
            return value;
        } else {
            return undefined;
        }
    }

    buildNewValue(): A | undefined {
        return undefined;
    }

    update(): void {
        this._newValue = undefined;
        this.processed = false;
        super.update();
    }

    addDependent(vertex: Vertex): void {
        this.dependents.add(vertex);
        this.incRefCount();
    }

    removeDependent(vertex: Vertex) {
        const wasRemoved = this.dependents.delete(vertex);

        if (!wasRemoved) {
            throw new Error(`Attempted to remove a non-dependent`);
        }

        this.decRefCount();
    }

    describe_(): string {
        return `, processed: ${this.processed}, new: ${this.newValue}`;
    }
}

export class StreamSinkVertex<A> extends StreamVertex<A> {
    buildNewValue(): A | undefined {
        return undefined;
    }

    fire(a: A) {
        this._newValue = a;
    }
}

export abstract class CellVertex<A> extends StreamVertex<A> {
    _oldValue?: A;

    get oldValue(): A {
        if (this._oldValue === undefined) {
            const a = this.buildOldValue();
            if (a === undefined) {
                throw new Error("Cell value cannot be undefined");
            }
            this._oldValue = a;
        }
        return this._oldValue!;
    }

    constructor(
        initValue?: A,
        newValue?: A,
        extraDependencies?: Array<Stream<any> | Cell<any>>,
    ) {
        super(extraDependencies);
        this._oldValue = initValue;
        this._newValue = newValue;
    }


    buildOldValue(): A {
        throw new Error("buildOldValue implementation is not provided");
    }

    buildNewValue(): A | undefined {
        return undefined;
    }

    update() {
        this._oldValue = this.newValue ?? this.oldValue;
        super.update();
    }

    describe_(): string {
        return `, old: ${this.oldValue}, new: ${this.newValue}`;
    }
}

export class CellSinkVertex<A> extends CellVertex<A> {
    fire(a: A): void {
        this._newValue = a;
    }
}

export class ConstCellVertex<A> extends CellVertex<A> {
    constructor(initValue: A) {
        super(initValue);
        this.processed = true;
    }

    update() {
    }

    describe_(): string {
        return `, value: ${this.oldValue}`;
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
    }

    initialize(): void {
        this.source.addDependent(this);
    }

    uninitialize(): void {
        this.source.addDependent(this);
    }

    process(): void {
        const a = this.source.newValue;
        if (a !== undefined) {
            this.h(a);
        }
    }
}
