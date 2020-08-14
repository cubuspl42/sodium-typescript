import { Stream } from "./Stream";
import { Cell } from "./Cell";

let totalRegistrations: number = 0;

export function getTotalRegistrations(): number {
    return totalRegistrations;
}

let nextId = 0;

export abstract class Vertex {
    static all: Array<Vertex> = [];

    protected constructor(initialVisited: boolean) {
        this._visited = initialVisited;
    }

    get typeName(): string | undefined {
        return undefined;
    }

    readonly id = ++nextId;

    private _refCount = 0;

    name?: string;

    readonly dependents?: Set<Vertex>;

    private _visited: boolean;

    get visited(): boolean {
        return this._visited;
    }

    markVisited(): void {
        this._visited = true;
    }

    initialize(): void {
    }

    uninitialize(): void {
    }

    process(): void {
    }

    postprocess(): void {
    }

    update(): void {
        this._visited = false;
    }

    incRefCount(): void {
        ++this._refCount;
        if (this._refCount == 1) {
            this.initialize();
            Vertex.all.push(this);
        }
    }

    decRefCount(): void {
        if (this._refCount <= 0) {
            throw new Error("Reference counter is already zero");
        }
        --this._refCount;
        if (this._refCount == 0) {
            this.uninitialize();
            const index = Vertex.all.indexOf(this);
            Vertex.all.splice(index, 1);
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

    protected _typeName?: string;

    readonly dependents = new Set<Vertex>();

    readonly extraDependencies: ReadonlyArray<Vertex>;

    constructor(
        initialVisited: boolean,
        extraDependencies?: Array<Stream<any> | Cell<any>>,
    ) {
        super(initialVisited);
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
            if (value === null) {
                throw new Error("Stream/Cell new value cannot be null");
            }
            this._newValue = value;
            this._typeName = this.typeName ?? typeName(value);
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

    addDependent(vertex: Vertex, weak?: boolean): void {
        this.dependents.add(vertex);
        if (weak !== true) {
            this.incRefCount();
        }
    }

    removeDependent(vertex: Vertex, weak?: boolean) {
        const wasRemoved = this.dependents.delete(vertex);

        if (!wasRemoved) {
            throw new Error(`Attempted to remove a non-dependent`);
        }

        if (weak !== true) {
            this.decRefCount();
        }
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

function typeName(a: any) {
    if (a instanceof Array) {
        if (a.length > 0) {
            return `Array<${typeName(a[0])}>`;
        }
    }
    const type = typeof a;
    if (type === "object") {
        return a.constructor.name;
    } else {
        return type;
    }
}

export abstract class CellVertex<A> extends StreamVertex<A> {
    _oldValue?: A;

    get typeName(): string {
        return this._typeName;
    }

    get oldValue(): A {
        if (this._oldValue === undefined) {
            const a = this.buildOldValue();
            if (a === undefined || a === null) {
                throw new Error("Cell value cannot be undefined/null");
            }
            this._typeName = this.typeName ?? typeName(a);
            this._oldValue = a;
        }
        return this._oldValue!;
    }

    constructor(
        initialVisited: boolean,
        extraDependencies?: Array<Stream<any> | Cell<any>>,
    ) {
        super(initialVisited, extraDependencies);
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
        super(false);
        this._oldValue = initValue;
        this._typeName = this.typeName ?? typeName(initValue);
        this.processed = true;
    }

    update() {
    }

    describe_(): string {
        return `, value: ${this.oldValue}`;
    }
}

export class ListenerVertex<A> extends Vertex {
    constructor(
        readonly source: StreamVertex<A>,
        readonly weak: boolean,
        private readonly h: (a: A) => void,
    ) {
        super(source.visited);
    }

    initialize(): void {
        this.source.addDependent(this, this.weak);
    }

    uninitialize(): void {
        this.source.removeDependent(this, this.weak);
    }

    process(): void {
        const a = this.source.newValue;
        if (a !== undefined) {
            this.h(a);
        }
    }
}
