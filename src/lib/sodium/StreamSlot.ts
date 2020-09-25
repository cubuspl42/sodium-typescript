import { Stream } from "./Stream";
import { StreamVertex } from './Vertex';
import { Transaction } from "./Transaction";
import { Unit } from "./Unit";

export class Sets {
    static filter<A>(s: ReadonlySet<A>, f: (a: A) => boolean): ReadonlySet<A> {
        return new Set(Array.from(s).filter((a): boolean => f(a)));
    }

    static deleteWhere<A>(s: Set<A>, f: (a: A) => boolean): void {
        s.forEach((e) => {
            if (f(e)) {
                s.delete(e);
            }
        });
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

interface SignalEntry<A> {
    readonly signal: StreamVertex<A>;
    readonly sDisconnect: StreamVertex<Unit>;
}

class StreamSlotVertex<A> extends StreamVertex<A> {
    constructor() {
        super();
    }

    private readonly signals = new Set<SignalEntry<A>>();

    private readonly newSignals = new Set<SignalEntry<A>>();

    initialize(): void {
        super.initialize();
        this.signals.forEach((entry) => {
            const { signal, sDisconnect } = entry;
            signal.addDependent(this);
            sDisconnect.addDependent(this);
        });
        this.newSignals.forEach((entry) => {
            const { signal, sDisconnect } = entry;
            signal.addDependent(this);
            sDisconnect.addDependent(this);
        });
    }

    uninitialize(): void {
        this.signals.forEach((entry) => {
            const { signal, sDisconnect } = entry;
            signal.removeDependent(this);
            sDisconnect.removeDependent(this);
        });
        this.newSignals.forEach((entry) => {
            const { signal, sDisconnect } = entry;
            signal.removeDependent(this);
            sDisconnect.removeDependent(this);
        });
        super.uninitialize();
    }

    buildVisited(): boolean {
        return false;
    }

    buildNewValue(): A | undefined {
        const nas = Sets.mapNotUndefined(this.signals, (entry) => {
            const { signal } = entry;
            return signal.newValue;
        });
        if (nas.size === 0) {
            return undefined;
        } else if (nas.size === 1) {
            const na = Sets.first(nas);
            return na;
        } else {
            throw new Error("Multiple signals emitted an event at the same time");
        }
    }

    process(t: Transaction) {
        console.log("Processing StreamSlot");
        super.process(t);
        t.resetEnqueue(() => {
            this.signals.forEach((e) => {
                if (e.sDisconnect.newValue !== undefined) {
                    console.log("StreamSlot disconnecting");

                    e.signal.removeDependent(this);
                    e.sDisconnect.removeDependent(this);
                    this.signals.delete(e);
                }
            });
        });
    }

    connect(entry: SignalEntry<A>) {
        Transaction.run(() => {
            const { signal, sDisconnect } = entry;

            this.newSignals.add(entry);
            if (this.refCount() > 0) {
                signal.addDependent(this);
                sDisconnect.addDependent(this);
            }

            const t = Transaction.currentTransaction!;

            t.resetEnqueue(() => {
                this.newSignals.forEach((entry) => {
                    this.signals.add(entry);
                });
                this.newSignals.clear();

                console.log(`Number of signals: ${this.signals.size}`);
            });
        });
    }
}

export class StreamSlot<A> extends Stream<A> {
    constructor(f?: (l: A, r: A) => A) {
        super(new StreamSlotVertex());
    }

    get slotVertex(): StreamSlotVertex<A> {
        return this._vertex as StreamSlotVertex<A>;
    }

    connect(
        signal: Stream<A>, args: {
            sDisconnect: Stream<Unit>
        }
    ) {
        this.slotVertex.connect({
            signal: signal._vertex,
            sDisconnect: args.sDisconnect._vertex,
        });
    }
}
