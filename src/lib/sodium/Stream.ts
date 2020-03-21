import { Vertex, StreamVertex, ListenerVertex, CellVertex } from "./Vertex";
import { Transaction } from "./Transaction";
import { Cell } from "./Cell";
//import { StreamLoop } from "./StreamLoop";
import { Tuple2 } from "./Tuple2";
import { Lazy } from "./Lazy";
import * as Z from "sanctuary-type-classes";
import { CellLoop } from "./CellLoop";
import { lookup } from "dns";

class MergeState<A> {
    constructor() { }
    left: A = null;
    left_present: boolean = false;
    right: A = null;
    right_present: boolean = false;
}

class SnapshotVertex<A, B, C> extends StreamVertex<C> {
    constructor(
        stream: Stream<A>,
        cell: Cell<B>,
        f: (a: A, b: B) => C,
    ) {
        super();

        this.f = f;
        this.stream = stream;
        this.cell = cell;

        stream.vertex.addDependent(this);
    }

    private readonly stream: Stream<A>;
    private readonly cell: Cell<B>;
    private readonly f: (a: A, b: B) => C;

    process(): boolean {
        const a = this.stream.vertex.newValue;

        // TODO: Fix other "!a"
        if (a === undefined) return false;

        const b = this.cell.vertex.oldValue;
        const c = this.f(a, b);
        this.fire(c);

        return false;
    }
}

class Snapshot4Vertex<A, B, C, D, E> extends StreamVertex<E> {
    constructor(
        stream: Stream<A>,
        cb: Cell<B>,
        cc: Cell<C>,
        cd: Cell<D>,
        f: (a: A, b: B, c: C, d: D) => E,
    ) {
        super();

        this.f = f;
        this.stream = stream;

        this.cb = cb;
        this.cc = cc;
        this.cd = cd;

        stream.vertex.addDependent(this);
    }

    private readonly stream: Stream<A>;

    private readonly cb: Cell<B>;
    private readonly cc: Cell<C>;
    private readonly cd: Cell<D>;

    private readonly f: (a: A, b: B, c: C, d: D) => E;

    process(): boolean {
        const a = this.stream.vertex.newValue;

        if (a === undefined) return false;

        const b = this.cb.vertex.oldValue;
        const c = this.cc.vertex.oldValue;
        const d = this.cd.vertex.oldValue;

        const e = this.f(a, b, c, d);

        this.fire(e);

        return false;
    }
}

class HoldVertex<A> extends CellVertex<A> {
    constructor(
        initValue: A,
        steps: StreamVertex<A>,
    ) {
        super(initValue);

        this.steps = steps;

        steps.addDependent(this);
    }

    private readonly steps: StreamVertex<A>;

    process(): boolean {
        const na = this.steps.newValue;
        if (na) {
            this.fire(na);
        }

        return false;
    }
}

class FilterVertex<A> extends StreamVertex<A> {
    constructor(
        s: StreamVertex<A>,
        f: (a: A) => boolean,
    ) {
        super();

        this.s = s;
        this.f = f;

        s.addDependent(this);
    }

    private readonly s: StreamVertex<A>;
    private readonly f: (a: A) => boolean;

    process(): boolean {
        const a = this.s.newValue;
        const f = this.f;
        if (!a) return;
        if (f(a)) {
            this.fire(a);
        }

        return false;
    }
}

class StreamMapVertex<A, B> extends StreamVertex<B> {
    constructor(
        source: StreamVertex<A>,
        f: (a: A) => B,
    ) {
        super();

        this.source = source;
        this.f = f;

        source.addDependent(this);
    }

    private readonly source: StreamVertex<A>;
    private readonly f: (a: A) => B;

    process(): boolean {
        const a = this.source.newValue;
        const f = this.f;
        if (!a) return false;
        this.fire(f(a));

        return false;
    }
}

export class Stream<A> {
    constructor(vertex?: StreamVertex<A>) {
        this.vertex = vertex || new StreamVertex();
    }

    vertex: StreamVertex<A>;

    rename(name: string): Stream<A> {
        this.vertex.name = name;
        return this;
    }

    /**
     * Transform the stream's event values according to the supplied function, so the returned
     * Stream's event values reflect the value of the function applied to the input
     * Stream's event values.
     * @param f Function to apply to convert the values. It may construct FRP logic or use
     *    {@link Cell#sample()} in which case it is equivalent to {@link Stream#snapshot(Cell)}ing the
     *    cell. Apart from this the function must be <em>referentially transparent</em>.
     */
    map<B>(f: (a: A) => B): Stream<B> {
        return new Stream(new StreamMapVertex(this.vertex, f));
    }

    /**
     * Transform the stream's event values into the specified constant value.
     * @param b Constant value.
     */
    mapTo<B>(b: B): Stream<B> {
        throw new Error();
    }

    /**
     * Variant of {@link Stream#merge(Stream, Lambda2)} that merges two streams and will drop an event
     * in the simultaneous case.
     * <p>
     * In the case where two events are simultaneous (i.e. both
     * within the same transaction), the event from <em>this</em> will take precedence, and
     * the event from <em>s</em> will be dropped.
     * If you want to specify your own combining function, use {@link Stream#merge(Stream, Lambda2)}.
     * s1.orElse(s2) is equivalent to s1.merge(s2, (l, r) -&gt; l).
     * <p>
     * The name orElse() is used instead of merge() to make it really clear that care should
     * be taken, because events can be dropped.
     */
    orElse(s: Stream<A>): Stream<A> {
        throw new Error();
    }

    /**
     * Merge two streams of the same type into one, so that events on either input appear
     * on the returned stream.
     * <p>
     * If the events are simultaneous (that is, one event from this and one from <em>s</em>
     * occurring in the same transaction), combine them into one using the specified combining function
     * so that the returned stream is guaranteed only ever to have one event per transaction.
     * The event from <em>this</em> will appear at the left input of the combining function, and
     * the event from <em>s</em> will appear at the right.
     * @param f Function to combine the values. It may construct FRP logic or use
     *    {@link Cell#sample()}. Apart from this the function must be <em>referentially transparent</em>.
     */
    merge(s: Stream<A>, f: (left: A, right: A) => A): Stream<A> {
        throw new Error();
    }

    /**
     * Return a stream that only outputs events for which the predicate returns true.
     */
    filter(f: (a: A) => boolean): Stream<A> {
        return new Stream(new FilterVertex(this.vertex, f));
    }

    /**
     * Return a stream that only outputs events that have present
     * values, discarding null values.
     */
    filterNotNull(): Stream<A> {
        return this.filter((a) => a !== null);
    }

    /**
     * Return a stream that only outputs events from the input stream
     * when the specified cell's value is true.
     */
    gate(c: Cell<boolean>): Stream<A> {
        throw new Error();

    }

	/**
	 * Variant of {@link snapshot(Cell, Lambda2)} that captures the cell's value
	 * at the time of the event firing, ignoring the stream's value.
	 */
    snapshot1<B>(c: Cell<B>): Stream<B> {
        return new Stream(new SnapshotVertex(this, c, (_, b) => b));
    }

	/**
	 * Return a stream whose events are the result of the combination using the specified
	 * function of the input stream's event value and the value of the cell at that time.
     * <P>
     * There is an implicit delay: State updates caused by event firings being held with
     * {@link Stream#hold(Object)} don't become visible as the cell's current value until
     * the following transaction. To put this another way, {@link Stream#snapshot(Cell, Lambda2)}
     * always sees the value of a cell as it was before any state changes from the current
     * transaction.
     */
    snapshot<B, C>(b: Cell<B>, f: (a: A, b: B) => C): Stream<C> {
        return new Stream(new SnapshotVertex(this, b, f));
    }

	/**
	 * Return a stream whose events are the result of the combination using the specified
	 * function of the input stream's event value and the value of the cells at that time.
     * <P>
     * There is an implicit delay: State updates caused by event firings being held with
     * {@link Stream#hold(Object)} don't become visible as the cell's current value until
     * the following transaction. To put this another way, snapshot()
     * always sees the value of a cell as it was before any state changes from the current
     * transaction.
     */
    snapshot3<B, C, D>(b: Cell<B>, c: Cell<C>, f_: (a: A, b: B, c: C) => D): Stream<D> {
        throw new Error();
    }

	/**
	 * Return a stream whose events are the result of the combination using the specified
	 * function of the input stream's event value and the value of the cells at that time.
     * <P>
     * There is an implicit delay: State updates caused by event firings being held with
     * {@link Stream#hold(Object)} don't become visible as the cell's current value until
     * the following transaction. To put this another way, snapshot()
     * always sees the value of a cell as it was before any state changes from the current
     * transaction.
     */
    snapshot4<B, C, D, E>(b: Cell<B>, c: Cell<C>, d: Cell<D>,
        f_: (a: A, b: B, c: C, d: D) => E): Stream<E> {
        return new Stream(new Snapshot4Vertex<A, B, C, D, E>(this, b, c, d, f_));
    }

	/**
	 * Return a stream whose events are the result of the combination using the specified
	 * function of the input stream's event value and the value of the cells at that time.
     * <P>
     * There is an implicit delay: State updates caused by event firings being held with
     * {@link Stream#hold(Object)} don't become visible as the cell's current value until
     * the following transaction. To put this another way, snapshot()
     * always sees the value of a cell as it was before any state changes from the current
     * transaction.
     */
    snapshot5<B, C, D, E, F>(b: Cell<B>, c: Cell<C>, d: Cell<D>, e: Cell<E>,
        f_: (a: A, b: B, c: C, d: D, e: E) => F): Stream<F> {
        throw new Error();
    }

	/**
	 * Return a stream whose events are the result of the combination using the specified
	 * function of the input stream's event value and the value of the cells at that time.
     * <P>
     * There is an implicit delay: State updates caused by event firings being held with
     * {@link Stream#hold(Object)} don't become visible as the cell's current value until
     * the following transaction. To put this another way, snapshot()
     * always sees the value of a cell as it was before any state changes from the current
     * transaction.
     */
    snapshot6<B, C, D, E, F, G>(b: Cell<B>, c: Cell<C>, d: Cell<D>, e: Cell<E>, f: Cell<F>,
        f_: (a: A, b: B, c: C, d: D, e: E, f: F) => G): Stream<G> {
        throw new Error();
    }

	/**
	 * Create a {@link Cell} with the specified initial value, that is updated
     * by this stream's event values.
     * <p>
     * There is an implicit delay: State updates caused by event firings don't become
     * visible as the cell's current value as viewed by {@link Stream#snapshot(Cell, Lambda2)}
     * until the following transaction. To put this another way,
     * {@link Stream#snapshot(Cell, Lambda2)} always sees the value of a cell as it was before
     * any state changes from the current transaction.
     */
    hold(initValue: A): Cell<A> {
        return new Cell(undefined, undefined, new HoldVertex(initValue, this.vertex));
    }

	/**
	 * A variant of {@link hold(Object)} with an initial value captured by {@link Cell#sampleLazy()}.
	 */
    holdLazy(initValue: Lazy<A>): Cell<A> {
        throw new Error();
    }

    /**
     * Transform an event with a generalized state loop (a Mealy machine). The function
     * is passed the input and the old state and returns the new state and output value.
     * @param f Function to apply to update the state. It may construct FRP logic or use
     *    {@link Cell#sample()} in which case it is equivalent to {@link Stream#snapshot(Cell)}ing the
     *    cell. Apart from this the function must be <em>referentially transparent</em>.
     */
    collect<B, S>(initState: S, f: (a: A, s: S) => Tuple2<B, S>): Stream<B> {
        throw new Error();
    }

    /**
     * A variant of {@link collect(Object, Lambda2)} that takes an initial state returned by
     * {@link Cell#sampleLazy()}.
     */
    collectLazy<B, S>(initState: Lazy<S>, f: (a: A, s: S) => Tuple2<B, S>): Stream<B> {
        throw new Error();
    }

    /**
     * Accumulate on input event, outputting the new state each time.
     * @param f Function to apply to update the state. It may construct FRP logic or use
     *    {@link Cell#sample()} in which case it is equivalent to {@link Stream#snapshot(Cell)}ing the
     *    cell. Apart from this the function must be <em>referentially transparent</em>.
     */
    accum<S>(initState: S, f: (a: A, s: S) => S): Cell<S> {
        const loop = new CellLoop<S>();
        const out = this.snapshot(loop, f).hold(initState);
        loop.loop(out);
        return out;
    }

    /**
     * A variant of {@link accum(Object, Lambda2)} that takes an initial state returned by
     * {@link Cell#sampleLazy()}.
     */
    accumLazy<S>(initState: Lazy<S>, f: (a: A, s: S) => S): Cell<S> {
        throw new Error();
    }

    /**
     * Return a stream that outputs only one value: the next event of the
     * input stream, starting from the transaction in which once() was invoked.
     */
    once(): Stream<A> {
        throw new Error();
    }

    listen(h: (a: A) => void): () => void {
        new ListenerVertex(this.vertex, h);
        return () => { };
    }

    /**
     * Fantasy-land Algebraic Data Type Compatability.
     * Stream satisfies the Functor and Monoid Categories (and hence Semigroup)
     * @see {@link https://github.com/fantasyland/fantasy-land} for more info
     */
}

/**
 * A forward reference for a {@link Stream} equivalent to the Stream that is referenced.
 */
export class StreamLoop<A> {
    assigned__: boolean = false;  // to do: Figure out how to hide this

    constructor() {
        throw new Error();
    }

    /**
     * Resolve the loop to specify what the StreamLoop was a forward reference to. It
     * must be invoked inside the same transaction as the place where the StreamLoop is used.
     * This requires you to create an explicit transaction with {@link Transaction#run(Lambda0)}
     * or {@link Transaction#runVoid(Runnable)}.
     */
    loop(sa_out: Stream<A>): void {
        throw new Error();
    }
}
