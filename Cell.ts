import { Lambda1, Lambda1_deps, Lambda1_toFunction,
         Lambda2, Lambda2_deps, Lambda2_toFunction,
         toSources } from "./Lambda";
import { Source, Vertex } from "./Vertex";
import { Transaction, transactionally, currentTransaction } from "./Transaction";
import { Lazy } from "./Lazy";
import { Listener } from "./Listener";
import { Stream } from "./Stream";
import { Operational } from "./Operational";

class LazySample<A> {
    constructor(cell : Cell<A>) {
        this.cell = cell;
    }
    cell : Cell<A>;
    hasValue : boolean = false;
    value : A = null;
}

export class Cell<A> {
	private str : Stream<A>;
	protected value : A;
	protected valueUpdate : A;
	private cleanup : () => void;
	protected lazyInitValue : Lazy<A>;  // Used by LazyCell

    constructor(initValue : A, str? : Stream<A>) {
        this.value = initValue;
        if (!str)
            this.str = new Stream<A>();
        else {
            this.str = str;
            let me = this;
            transactionally(() => {
                me.cleanup = me.str.listen_(Vertex.NULL, (a : A) => {
                        if (this.valueUpdate == null) {
                            currentTransaction.last(() => {
                                me.value = me.valueUpdate;
                                me.lazyInitValue = null;
                                me.valueUpdate = null;
                            });
                        }
                        me.valueUpdate = a;
                    }, false);
            });
        }
    }

    getVertex__() : Vertex {
        return null;
    }

    getStream__() : Stream<A> {  // TO DO: Figure out how to hide this
        return this.str;
    }

    /**
     * Sample the cell's current value.
     * <p>
     * It may be used inside the functions passed to primitives that apply them to {@link Stream}s,
     * including {@link Stream#map(Lambda1)} in which case it is equivalent to snapshotting the cell,
     * {@link Stream#snapshot(Cell, Lambda2)}, {@link Stream#filter(Lambda1)} and
     * {@link Stream#merge(Stream, Lambda2)}.
     * It should generally be avoided in favour of {@link listen(Handler)} so you don't
     * miss any updates, but in many circumstances it makes sense.
     */
    sample() : A {
        return transactionally(() => { return this.sampleNoTrans__(); });
    }

    sampleNoTrans__() : A {  // TO DO figure out how to hide this
        return this.value;
    }

    /**
     * A variant of {@link sample()} that works with {@link CellLoop}s when they haven't been looped yet.
     * It should be used in any code that's general enough that it could be passed a {@link CellLoop}.
     * @see Stream#holdLazy(Lazy) Stream.holdLazy()
     */
    sampleLazy() : Lazy<A> {
        let me = this;
        return transactionally(() => me.sampleLazyNoTrans__());
    }

    sampleLazyNoTrans__() : Lazy<A> {  // TO DO figure out how to hide this
        let me = this,
            s = new LazySample<A>(me);
        currentTransaction.last(() => {
            s.value = me.valueUpdate != null ? me.valueUpdate : me.sampleNoTrans__();
            s.hasValue = true;
            s.cell = null;
        });
        return new Lazy<A>(() => {
            if (s.hasValue)
                return s.value;
            else
                return s.cell.sample();
        });
    }

    /**
     * Transform the cell's value according to the supplied function, so the returned Cell
     * always reflects the value of the function applied to the input Cell's value.
     * @param f Function to apply to convert the values. It must be <em>referentially transparent</em>.
     */
    map<B>(f : ((a : A) => B) | Lambda1<A,B>) : Cell<B> {
        let c = this;
        return transactionally(() =>
            Operational.updates(c).map(f).holdLazy(c.sampleLazy().map(Lambda1_toFunction(f)))
        );
    }

	/**
	 * Listen for updates to the value of this cell. This is the observer pattern. The
	 * returned {@link Listener} has a {@link Listener#unlisten()} method to cause the
	 * listener to be removed. This is an OPERATIONAL mechanism is for interfacing between
	 * the world of I/O and for FRP.
	 * @param h The handler to execute when there's a new value.
	 *   You should make no assumptions about what thread you are called on, and the
	 *   handler should not block. You are not allowed to use {@link CellSink#send(Object)}
	 *   or {@link StreamSink#send(Object)} in the handler.
	 *   An exception will be thrown, because you are not meant to use this to create
	 *   your own primitives.
     */
    listen(h : (a : A) => void) : () => void {
        return transactionally(() => {
            return Operational.value(this).listen(h);
        });
    }
}