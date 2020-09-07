import { Stream } from "./Stream";
import { StreamVertex } from './Vertex';
import { Transaction } from "./Transaction";

export class Sets {
    static filter<A>(s: ReadonlySet<A>, f: (a: A) => boolean): ReadonlySet<A> {
        return new Set(Array.from(s).filter((a): boolean => f(a)));
    }

    static first<A, B>(s: ReadonlySet<A>): A {
        return Array.from(s)[0];
    }

    static mapNotUndefined<A, B>(s: ReadonlySet<A>, f: (a: A) => B | undefined): ReadonlySet<B> {
        return new Set(Array.from(s).map(f).filter((b) => b !== undefined));
    }
}

enum StreamSlotMultiplicity {
    singleSignal,
    multipleSignals,
}

class StreamSlotVertex<A> extends StreamVertex<A> {
    constructor() {
        super();
    }

    private readonly signals = new Set<Stream<A>>();

    private readonly newSignals = new Set<Stream<A>>();

    initialize(): void {
        super.initialize();
        this.signals.forEach((signal) => {
            signal._vertex.addDependent(this);
        });
        this.newSignals.forEach((signal) => {
            signal._vertex.addDependent(this);
        });
    }

    uninitialize(): void {
        this.signals.forEach((signal) => {
            signal._vertex.removeDependent(this);
        });
        this.newSignals.forEach((signal) => {
            signal._vertex.removeDependent(this);
        });
        super.uninitialize();
    }

    buildVisited(): boolean {
        return false;
    }

    buildNewValue(): A | undefined {
        const nas = Sets.mapNotUndefined(this.signals, (signal) => signal._vertex.newValue);
        if (nas.size === 0) {
            return undefined;
        } else if (nas.size === 1) {
            const na = Sets.first(nas);
            return na;
        } else {
            throw new Error("Multiple signals emitted an event at the same time");
        }
    }

    connect(signal: Stream<A>) {
        this.newSignals.add(signal);
        if (this.refCount() > 0) {
            signal._vertex.addDependent(this);
        }

        const t = Transaction.currentTransaction!;

        t.resetEnqueue(() => {
            this.newSignals.forEach((signal) => {
                this.signals.add(signal);
            });
            this.newSignals.clear();
        })
    }
}

export class StreamSlot<A> extends Stream<A> {
    constructor(f?: (l: A, r: A) => A) {
        super(new StreamSlotVertex());
    }

    get slotVertex(): StreamSlotVertex<A> {
        return this._vertex as StreamSlotVertex<A>;
    }

    connect(signal: Stream<A>) {
        this.slotVertex.connect(signal);
    }
}
