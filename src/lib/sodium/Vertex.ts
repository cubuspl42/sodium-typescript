import { Transaction } from "./Transaction";

let totalRegistrations: number = 0;
export function getTotalRegistrations(): number {
    return totalRegistrations;
}

export abstract class Vertex {
    name?: string;

    readonly dependents?: Set<Vertex>;

    visited = false;

    reset(): void { // TODO: remove?
        this.visited = false;
    }

    notify(): void { }

    update(): void {
        this.visited = false;
    }

    refCount(): number {
        return 0;
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

    _newValue?: A;

    get newValue(): A | undefined {
        // if (this.visited) {
        //     const value = this.processed ? this._newValue : this.buildNewValue();
        //     this._newValue = value;
        //     this.processed = true;
        //     return value;
        // } else {
        //     return undefined;
        // }

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

export class CellVertex<A> extends StreamVertex<A> {
    _oldValue?: A;

    get oldValue(): A {
        if (this._oldValue === undefined) {
            this._oldValue = this.buildOldValue();
        }
        return this._oldValue;
    }

    constructor(initValue?: A, newValue?: A) {
        super();
        this._oldValue = initValue;
        this._newValue = newValue;
    }

    buildOldValue(): A {
        throw new Error("Unimplemented");
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

    fire(a: A) {
        throw new Error("Unimplemented");
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

        source.addDependent(this);
    }

    notify(): void {
        const a = this.source.newValue;
        if (a !== undefined) {
            this.h(a);
        }
    }

    process() {
        return false;
    }
}
