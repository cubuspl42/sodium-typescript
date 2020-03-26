import { Transaction } from "./Transaction";

let totalRegistrations: number = 0;
export function getTotalRegistrations(): number {
    return totalRegistrations;
}

export abstract class Vertex {
    name?: string;

    readonly dependents?: Set<Vertex>;

    visited = false;

    processed = false;

    reset(): void {
        this.visited = false;
    }

    notify(): void { }

    abstract process(): boolean;

    update(): void {
        this.processed = false;
    }

    refCount(): number {
        return 0;
    }

    describe(): string {
        return `${this.constructor.name} {name: ${this.name ?? "unnamed"}, processed: ${this.processed}${this.describe_()}}`;
    }

    describe_(): string {
        return "";
    }
}

export class StreamVertex<A> extends Vertex {
    readonly dependents = new Set<Vertex>();

    newValue?: A;

    visited = false;

    fire(a: A) {
        this.newValue = a;
    }

    process(): boolean {
        return false;
    }

    update(): void {
        this.newValue = undefined;
        super.update();
    }

    addDependent(vertex: Vertex): void {
        this.dependents.add(vertex);
    }

    describe_(): string {
        return `, new: ${this.newValue}`;
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

    process(): boolean {
        Transaction.log(() => `processing CellVertex [${this.name ?? ""}]`);
        return false;
    }

    buildValue(): A {
        throw new Error("Unimplemented");
    }

    update() {
        this._oldValue = this.newValue ?? this.oldValue;
        super.update();
    }

    describe_(): string {
        return `, old: ${this.oldValue}, new: ${this.newValue}`;
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

    update(): void {
    }
}
