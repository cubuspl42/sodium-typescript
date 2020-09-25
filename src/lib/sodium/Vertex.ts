import { Stream } from "./Stream";
import { Cell } from "./Cell";
import { Transaction } from "./Transaction";

let totalRegistrations: number = 0;

export function getTotalRegistrations(): number {
    return totalRegistrations;
}

let nextId = 0;

export class None {
    static getOrElse<A>(a: A | None, f: () => A): A {
        return a instanceof None ? f() : a;
    }

    static map<A, B>(a: A | None, f: (a: A) => B): B | None {
        return a instanceof None ? none : f(a);
    }
}

export const none = new None();

export interface Vertex {

}

export abstract class _Vertex implements Vertex {
    private readonly extraDependencies: ReadonlyArray<Vertex>;

    protected constructor(
        extraDependencies?: ReadonlyArray<Vertex>,
    ) {
        this.extraDependencies = extraDependencies ?? [];
    }

    static all: Array<_Vertex> = [];

    get typeName(): string | undefined {
        return undefined;
    }

    readonly id = ++nextId;

    readonly birthTransactionId = Transaction.currentTransaction?.id;

    private _refCount = 0;

    name?: string;

    readonly dependents?: Set<_Vertex>;

    private _visited?: boolean = undefined;

    get visited(): boolean {
        return this._visited ?? this.buildVisited();
    }

    get visitedRaw(): boolean {
        return this._visited ?? false;
    }

    abstract buildVisited(): boolean;

    markVisited(): void {
        this._visited = true;
    }

    protected initialize(): void {
        this.extraDependencies.forEach((d) => (d as _Vertex).incRefCount());
        const t = Transaction.currentTransaction!;
        t.resetEnqueue(() => this.reset());
    }

    protected uninitialize(): void {
        this.extraDependencies.forEach((d) => (d as _Vertex).decRefCount());
    }

    process(t: Transaction): void {
        t.resetEnqueue(() => this.reset());
    }

    reset(): void {
        this._visited = false;
    }

    incRefCount(): void {
        ++this._refCount;
        if (this._refCount == 1) {
            this.initialize();
            _Vertex.all.push(this);
        }
    }

    decRefCount(): void {
        if (this._refCount <= 0) {
            throw new Error("Reference counter is already zero");
        }
        --this._refCount;
        if (this._refCount == 0) {
            this.uninitialize();
            const index = _Vertex.all.indexOf(this);
            _Vertex.all.splice(index, 1);
        }
    }

    refCount(): number {
        return this._refCount;
    }

    describe(): string {
        return `${this.constructor.name} {name: ${this.name ?? "unnamed"}${this.describe_()}}`;
    }

    protected describe_(): string {
        return "";
    }
}

export abstract class StreamVertex<A> extends _Vertex {
    processed = false;

    protected _typeName?: string;

    readonly dependents = new Set<_Vertex>();

    constructor(
        extraDependencies?: Array<Stream<any> | Cell<any>>,
    ) {
        super(
            extraDependencies !== undefined ?
                extraDependencies.map((d) => d._vertex) : []
        );
    }

    private _newValue: A | None = none;

    get hasNewValue(): boolean {
        return this._newValue !== none;
    }

    get newValue(): A | None {
        const visited = this.visited;
        // const visited = true;
        // TODO: Re-enable the visited vertex optimization
        // Disabling because of switchC on cell loop birth-visited issue
        if (!(this._newValue instanceof None)) {
            return this._newValue;
        } else if (visited && !this.processed) {
            const value = this.buildNewValue();
            this._newValue = value;
            this._typeName = this.typeName ?? typeName(value);
            this.processed = true;
            return value;
        } else {
            return none;
        }
    }

    process(t: Transaction): void {
        this.newValue;
        super.process(t);
    }

    buildNewValue(): A | None {
        return none;
    }

    reset(): void {
        this._newValue = none;
        this.processed = false;
        super.reset();
    }

    addDependent(vertex: _Vertex, weak?: boolean): void {
        this.dependents.add(vertex);
        if (weak !== true) {
            this.incRefCount();
        }
    }

    removeDependent(vertex: _Vertex, weak?: boolean) {
        if (this.refCount() === 0) {
            return;
        }

        const wasRemoved = this.dependents.delete(vertex);

        if (!wasRemoved) {
            throw new Error(`Attempted to remove a non-dependent`);
        }

        if (weak !== true) {
            this.decRefCount();
        }
    }

    protected initialize() {
        super.initialize();
    }

    describe_(): string {
        return `, processed: ${this.processed}, new: ${this.newValue}`;
    }
}

export class StreamSinkVertex<A> extends StreamVertex<A> {
    _firedValue: A | None;

    buildNewValue(): A | None {
        return this._firedValue;
    }

    fire(a: A) {
        Transaction.run((t) => {
            this._firedValue = a;
            t.addRoot(this);
        });
    }

    buildVisited(): boolean {
        return false;
    }

    reset() {
        this._firedValue = none;
        super.reset();
    }
}

function typeName(a: any) {
    if (a instanceof Array) {
        if (a.length > 0) {
            return `Array<${typeName(a[0])}>`;
        }
    }
    const type = typeof a;
    if (type === "object" && a !== null) {
        return a.constructor.name;
    } else {
        return type;
    }
}

export abstract class CellVertex<A> extends StreamVertex<A> {
    _oldValue: A | None = none;

    get typeName(): string {
        return this._typeName;
    }

    get oldValue(): A {
        if (this._oldValue instanceof None) {
            const a = this.buildOldValue();
            this._typeName = this.typeName ?? typeName(a);
            this._oldValue = a;
            return a;
        } else {
            return this._oldValue;
        }
    }

    constructor(
        extraDependencies?: Array<Stream<any> | Cell<any>>,
    ) {
        super(extraDependencies);
    }

    buildOldValue(): A {
        throw new Error("buildOldValue implementation is not provided");
    }

    buildNewValue(): A | None {
        return none;
    }

    process(t: Transaction) {
        t.updateEnqueue(() => this.update());
        super.process(t);
    }

    protected initialize() {
        const t = Transaction.currentTransaction!;
        t.updateEnqueue(() => this.update());
        super.initialize();
    }

    update() {
        this._oldValue = None.getOrElse(this.newValue, () => this.oldValue);
    }

    describe_(): string {
        return `, old: ${this.oldValue}, new: ${this.newValue}`;
    }
}

export class CellSinkVertex<A> extends CellVertex<A> {
    _firedValue: A | None = none;

    constructor(initValue: A) {
        super();
        this._oldValue = initValue;
    }

    fire(a: A): void {
        this._firedValue = a;
    }

    buildNewValue(): A | None {
        return this._firedValue;
    }

    buildVisited(): boolean {
        return false;
    }

    reset() {
        this._firedValue = none;
        super.reset();
    }
}

export class ConstCellVertex<A> extends CellVertex<A> {
    constructor(initValue: A) {
        super();
        this._oldValue = initValue;
        this._typeName = this.typeName ?? typeName(initValue);
        this.processed = true;
    }

    describe_(): string {
        return `, value: ${this.oldValue}`;
    }

    buildVisited(): boolean {
        return false;
    }
}

export class ListenerVertex<A> extends _Vertex {
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
        super.initialize();
        this.source.addDependent(this, this.weak);
    }

    uninitialize(): void {
        this.source.removeDependent(this, this.weak);
        super.uninitialize();
    }

    process(t: Transaction): void {
        const a = this.source.newValue;
        if (!(a instanceof None)) {
            t.effectEnqueue(() => {
                this.h(a);
            });
        }
        super.process(t);
    }
}

export class ProcessVertex<A> extends _Vertex {
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
        if (!(a instanceof None)) {
            this.h(a);
        }
    }
}
