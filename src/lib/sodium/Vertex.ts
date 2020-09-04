import { Stream } from "./Stream";
import { Cell } from "./Cell";
import { Transaction } from "./Transaction";

let totalRegistrations: number = 0;

export function getTotalRegistrations(): number {
    return totalRegistrations;
}

let nextId = 0;

export abstract class Vertex {
    protected constructor() {
        console.log();
    }

    static all: Array<Vertex> = [];

    get typeName(): string | undefined {
        return undefined;
    }

    readonly id = ++nextId;

    readonly birthTransactionId = Transaction.currentTransaction?.id;

    private _refCount = 0;

    name?: string;

    readonly dependents?: Set<Vertex>;

    private _visited?: boolean = undefined;

    get visited(): boolean {
        const visited = this._visited ?? this.buildVisited();
        return visited;
    }

    get visitedRaw(): boolean {
        return this._visited ?? false;
    }

    abstract buildVisited(): boolean;

    markVisited(): void {
        this._visited = true;
    }

    initialize(): void {
    }

    uninitialize(): void {
    }

    process(t: Transaction): void {
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

export abstract class StreamVertex<A> extends Vertex {
    processed = false;

    protected _typeName?: string;

    readonly dependents = new Set<Vertex>();

    readonly extraDependencies: ReadonlyArray<Vertex>;

    constructor(
        extraDependencies?: Array<Stream<any> | Cell<any>>,
    ) {
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
        const visited = this.visited;
        // const visited = true;
        // TODO: Re-enable the visited vertex optimization
        // Disabling because of switchC on cell loop birth-visited issue
        if (this._newValue !== undefined) {
            return this._newValue;
        } else if (visited && !this.processed) {
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

    process(): void {
        this.newValue;
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
        Transaction.run((t) => {
            this._newValue = a;
            t.addRoot(this);
        });
    }

    buildVisited(): boolean {
        return false;
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
        extraDependencies?: Array<Stream<any> | Cell<any>>,
    ) {
        super(extraDependencies);
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

    buildVisited(): boolean {
        return false;
    }
}

export class ConstCellVertex<A> extends CellVertex<A> {
    constructor(initValue: A) {
        super();
        this._oldValue = initValue;
        this._typeName = this.typeName ?? typeName(initValue);
        this.processed = true;
    }

    update() {
    }

    describe_(): string {
        return `, value: ${this.oldValue}`;
    }

    buildVisited(): boolean {
        return false;
    }
}

export class ListenerVertex<A> extends Vertex {
    constructor(
        readonly source: StreamVertex<A>,
        readonly weak: boolean,
        private readonly h: (a: A) => void,
    ) {
        super();
    }

    buildVisited(): boolean {
        return this.source.visited;
    }

    initialize(): void {
        this.source.addDependent(this, this.weak);
    }

    uninitialize(): void {
        this.source.removeDependent(this, this.weak);
    }

    process(t: Transaction): void {
        const a = this.source.newValue;
        if (a !== undefined) {
            t.postEnqueue(() => {
                this.h(a);
            });
        }
    }
}

export class ProcessVertex<A> extends Vertex {
    constructor(
        readonly source: StreamVertex<A>,
        private readonly h: (a: A) => void,
    ) {
        super();
    }

    buildVisited(): boolean {
        return this.source.visited;
    }

    initialize(): void {
        this.source.addDependent(this);
    }

    uninitialize(): void {
        this.source.removeDependent(this);
    }

    process(t: Transaction): void {
        const a = this.source.newValue;
        if (a !== undefined) {
            this.h(a);
        }
    }
}
