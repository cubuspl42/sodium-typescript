import { CellVertex, ConstCellVertex, ListenerVertex, StreamVertex } from "./Vertex";
import { Lazy } from "./Lazy";
import { HoldVertex, Stream } from "./Stream";
import { Lambda1, Lambda1_deps, Lambda1_toFunction } from "./Lambda";

class CellMapVertex<A, B> extends CellVertex<B> {
    constructor(
        source: CellVertex<A>,
        f: (a: A) => B,
        extraDependencies?: Array<Stream<any> | Cell<any>>,
    ) {
        super(source.visited, extraDependencies);

        this.f = f;
        this.source = source;
    }

    private readonly source: CellVertex<A>;
    private readonly f: (a: A) => B;

    initialize() {
        super.initialize();
        const f = this.f;
        this.source.addDependent(this);
    }

    uninitialize() {
        super.uninitialize();
        this.source.removeDependent(this);
    }

    buildOldValue(): B {
        const f = this.f;
        return f(this.source.oldValue);
    }

    buildNewValue(): B | undefined {
        const f = this.f;
        const na = this.source.newValue;
        const nb = na !== undefined ? f(na) : undefined;
        return nb;
    }
}

class CellApplyVertex<A, B> extends CellVertex<B> {
    constructor(
        cf: CellVertex<(a: A) => B>,
        ca: CellVertex<A>,
    ) {
        super(cf.visited || ca.visited);

        this.cf = cf;
        this.ca = ca;
    }

    private readonly cf: CellVertex<(a: A) => B>;
    private readonly ca: CellVertex<A>;

    initialize() {
        this.cf.addDependent(this);
        this.ca.addDependent(this);
    }

    uninitialize() {
        this.cf.removeDependent(this);
        this.ca.removeDependent(this);
    }

    buildOldValue(): B {
        const f = this.cf.oldValue;
        return f(this.ca.oldValue);
    }

    buildNewValue(): B | undefined {
        const nf = this.cf.newValue;
        const na = this.ca.newValue;

        if (nf !== undefined || na !== undefined) {
            const f = nf ?? this.cf.oldValue;
            const a = na ?? this.ca.oldValue;
            return f(a);
        } else {
            return undefined;
        }
    }
}

class CellLiftVertex<A, B, C> extends CellVertex<C> {
    constructor(
        ca: CellVertex<A>,
        cb: CellVertex<B>,
        f: (a: A, b: B) => C,
    ) {
        super(
            ca.visited ||
            cb.visited
        );
        this.ca = ca;
        this.cb = cb;
        this.f = f;
    }

    private readonly ca: CellVertex<A>;
    private readonly cb: CellVertex<B>;
    private readonly f: (a: A, b: B) => C;

    initialize(): void {
        this.ca.addDependent(this);
        this.cb.addDependent(this);
    }


    uninitialize(): void {
        this.ca.removeDependent(this);
        this.cb.removeDependent(this);
    }

    buildOldValue(): C {
        const f = this.f;
        return f(this.ca.oldValue, this.cb.oldValue);
    }

    buildNewValue(): C | undefined {
        const na = this.ca.newValue;
        const nb = this.cb.newValue;

        if (na !== undefined || nb !== undefined) {
            const f = this.f;
            const a = na ?? this.ca.oldValue;
            const b = nb ?? this.cb.oldValue;
            return f(a, b);
        } else {
            return undefined;
        }
    }
}

class CellLift6Vertex<A, B, C, D, E, F, G> extends CellVertex<G> {
    constructor(
        f: (a?: A, b?: B, c?: C, d?: D, e?: E, f?: F) => G,
        ca?: CellVertex<A>,
        cb?: CellVertex<B>,
        cc?: CellVertex<C>,
        cd?: CellVertex<D>,
        ce?: CellVertex<E>,
        cf?: CellVertex<F>,
    ) {
        super(
            ca.visited ||
            cb.visited ||
            cc.visited ||
            cd.visited ||
            ce.visited ||
            cf.visited
        );

        this.ca = ca;
        this.cb = cb;
        this.cc = cc;
        this.cd = cd;
        this.ce = ce;
        this.cf = cf;

        this.f = f;
    }

    private readonly ca?: CellVertex<A>;
    private readonly cb?: CellVertex<B>;
    private readonly cc?: CellVertex<C>;
    private readonly cd?: CellVertex<D>;
    private readonly ce?: CellVertex<E>;
    private readonly cf?: CellVertex<F>;

    private readonly f: (a?: A, b?: B, c?: C, d?: D, e?: E, f?: F) => G;

    initialize(): void {
        this.ca?.addDependent(this);
        this.cb?.addDependent(this);
        this.cc?.addDependent(this);
        this.cd?.addDependent(this);
        this.ce?.addDependent(this);
        this.cf?.addDependent(this);
    }

    uninitialize(): void {
        this.ca?.removeDependent(this);
        this.cb?.removeDependent(this);
        this.cc?.removeDependent(this);
        this.cd?.removeDependent(this);
        this.ce?.removeDependent(this);
        this.cf?.removeDependent(this);
    }

    buildOldValue(): G {
        const f = this.f;
        return f(
            this.ca?.oldValue,
            this.cb?.oldValue,
            this.cc?.oldValue,
            this.cd?.oldValue,
            this.ce?.oldValue,
            this.cf?.oldValue,
        );
    }

    buildNewValue(): G | undefined {
        const na = this.ca?.newValue;
        const nb = this.cb?.newValue;
        const nc = this.cc?.newValue;
        const nd = this.cd?.newValue;
        const ne = this.ce?.newValue;
        const nf = this.cf?.newValue;

        if (
            na !== undefined ||
            nb !== undefined ||
            nc !== undefined ||
            nd !== undefined ||
            ne !== undefined ||
            nf !== undefined
        ) {
            const a = na ?? this.ca?.oldValue;
            const b = nb ?? this.cb?.oldValue;
            const c = nc ?? this.cc?.oldValue;
            const d = nd ?? this.cd?.oldValue;
            const e = ne ?? this.ce?.oldValue;
            const f = nf ?? this.cf?.oldValue;

            const fn = this.f;

            return fn(a, b, c, d, e, f);
        } else {
            return undefined;
        }
    }
}


class CellLiftArrayVertex<A> extends CellVertex<A[]> {
    constructor(ca: readonly Cell<A>[]) {
        super(ca.some((c) => c.vertex.visited));

        this.caa = ca;
    }

    private readonly caa: readonly Cell<A>[];

    initialize(): void {
        this.caa.forEach((a) => a.vertex.addDependent(this));
    }

    uninitialize(): void {
        this.caa.forEach((a) => a.vertex.removeDependent(this));
    }

    buildOldValue(): A[] {
        return this.caa.map(a => a.vertex.oldValue);
    }

    buildNewValue(): A[] | undefined {
        if (this.caa.some((ca) => ca.vertex.newValue !== undefined)) {
            const na = this.caa.map((ca) => ca.vertex.newValue ?? ca.vertex.oldValue);
            return na;
        } else {
            return undefined;
        }
    }
}

class SwitchCVertex<A> extends CellVertex<A> {
    constructor(cca: CellVertex<Cell<A>>) {
        super(cca.visited);
        // What about the old_cca_value.visited? Loops...

        this.cca = cca;
    }

    private readonly cca: CellVertex<Cell<A>>;

    initialize(): void {
        this.cca.addDependent(this);
        const ca = this.cca.oldValue;
        ca.vertex.addDependent(this);
    }

    uninitialize(): void {
        const ca = this.cca.oldValue;
        ca.vertex.removeDependent(this);

        this.cca.removeDependent(this);
    }

    buildOldValue(): A {
        const ca = this.cca.oldValue;
        return ca.vertex.oldValue;
    }

    buildNewValue(): A | undefined {
        const oca = this.cca.oldValue.vertex;
        const nca = this.cca.newValue?.vertex;
        if (nca !== undefined) {
            return nca.newValue ?? nca.oldValue;
        } else {
            return oca.newValue;
        }
    }

    postprocess(): void {
        const oca = this.cca.oldValue.vertex;
        const nca = this.cca.newValue?.vertex;

        if (nca !== undefined) {
            oca.removeDependent(this);
            nca.addDependent(this);
        }
    }
}

class SwitchSVertex<A> extends StreamVertex<A> {
    constructor(csa: CellVertex<Stream<A>>) {
        // const osa = csa.oldValue.vertex;
        // super(csa.visited || osa.visited);

        // TODO: Fix this
        // ^ Throws "CellLoop hasn't been looped yet" in some cases

        super(csa.visited);

        this.csa = csa;
    }

    private readonly csa: CellVertex<Stream<A>>;

    initialize(): void {
        this.csa.addDependent(this);
        this.csa.oldValue?.vertex?.addDependent(this);
    }

    uninitialize(): void {
        this.csa.removeDependent(this);
        this.csa.oldValue?.vertex?.removeDependent(this);
    }

    buildNewValue(): A | undefined {
        const osa = this.csa.oldValue.vertex;
        return osa.newValue;
    }

    postprocess(): void {
        const osa = this.csa.oldValue.vertex;
        const nsa = this.csa.newValue?.vertex;

        // This is done in `postBuildNewValue`, not `buildNewValue`, because evaluating `csa.newValue` in `buildNewValue` doesn't
        // work when the new value of `csa` depends on the new value of this stream (which is not impossible).
        // TODO: Check how Sodium master handles this
        if (nsa !== undefined) {
            osa.removeDependent(this);
            nsa.addDependent(this);
        }
    }
}

class CellCalmVertex<A> extends CellVertex<A> {
    constructor(
        source: CellVertex<A>,
        eq: (l: A, r: A) => boolean,
    ) {
        super(source.visited, undefined);

        this.eq = eq;
        this.source = source;
    }

    private readonly source: CellVertex<A>;
    private readonly eq: (l: A, r: A) => boolean;

    initialize() {
        super.initialize();
        this.source.addDependent(this);
    }

    uninitialize() {
        super.uninitialize();
        this.source.removeDependent(this);
    }

    buildOldValue(): A {
        return this.source.oldValue;
    }

    buildNewValue(): A | undefined {
        const eq = this.eq;
        const oa = this.oldValue;
        const na = this.source.newValue;
        if (!(eq(oa, na))) {
            return na;
        } else {
            return undefined;
        }
    }
}


export class Cell<A> {
    vertex: CellVertex<A>;

    constructor(initValue?: A, str?: Stream<A>, vertex?: CellVertex<A>) {
        if (vertex !== undefined) {
            this.vertex = vertex;
        } else if (initValue !== undefined && str !== undefined) {
            this.vertex = new HoldVertex<A>(new Lazy(() => initValue), str.vertex);
        } else {
            this.vertex = new ConstCellVertex<A>(initValue!);
        }
    }

    rename(name: string): Cell<A> {
        this.vertex.name = name;
        // Transaction.log(() => `renaming ${this.constructor.name} to "${name}"`);
        return this;
    }

    sample(): A {
        // this.vertex.incRefCount(); // Was this ever needed?
        const value = this.vertex.oldValue;
        // this.vertex.decRefCount();
        return value;
    }

    /**
     * A variant of {@link sample()} that works with {@link CellLoop}s when they haven't been looped yet.
     * It should be used in any code that's general enough that it could be passed a {@link CellLoop}.
     * @see Stream#holdLazy(Lazy) Stream.holdLazy()
     */
    sampleLazy(): Lazy<A> {
        return new Lazy(() => this.vertex.oldValue);
    }

    /**
     * Transform the cell's value according to the supplied function, so the returned Cell
     * always reflects the value of the function applied to the input Cell's value.
     * @param f Function to apply to convert the values. It must be <em>referentially transparent</em>.
     */
    map<B>(f: ((a: A) => B) | Lambda1<A, B>): Cell<B> {
        // TODO: Transaction.run
        const fn = Lambda1_toFunction(f);
        const deps = Lambda1_deps(f);
        return new Cell(undefined, undefined, new CellMapVertex(this.vertex, fn, deps));
    }

    /**
     * Lift a binary function into cells, so the returned Cell always reflects the specified
     * function applied to the input cells' values.
     * @param fn Function to apply. It must be <em>referentially transparent</em>.
     */
    lift<B, C>(b: Cell<B>, f: (a: A, b: B) => C): Cell<C> {
        // TODO: Transaction.run
        return new Cell(undefined, undefined, new CellLiftVertex(this.vertex, b.vertex, f));
    }

    /**
     * Lift a ternary function into cells, so the returned Cell always reflects the specified
     * function applied to the input cells' values.
     * @param fn Function to apply. It must be <em>referentially transparent</em>.
     */
    lift3<B, C, D>(b: Cell<B>, c: Cell<C>,
                   fn0: (a: A, b: B, c: C) => D): Cell<D> {
        return this._lift6((a, b, c) => fn0(a!, b!, c!), b, c);
    }

    /**
     * Lift a quaternary function into cells, so the returned Cell always reflects the specified
     * function applied to the input cells' values.
     * @param fn Function to apply. It must be <em>referentially transparent</em>.
     */
    lift4<B, C, D, E>(b: Cell<B>, c: Cell<C>, d: Cell<D>,
                      fn0: (a: A, b: B, c: C, d: D) => E): Cell<E> {
        return this._lift6((a, b, c, d) => fn0(a!, b!, c!, d!), b, c, d);
    }

    /**
     * Lift a 5-argument function into cells, so the returned Cell always reflects the specified
     * function applied to the input cells' values.
     * @param fn Function to apply. It must be <em>referentially transparent</em>.
     */
    lift5<B, C, D, E, F>(b: Cell<B>, c: Cell<C>, d: Cell<D>, e: Cell<E>,
                         fn0: (a: A, b: B, c: C, d: D, e: E) => F): Cell<F> {
        // TODO: Transaction.run

        throw new Error();
    }

    /**
     * Lift a 6-argument function into cells, so the returned Cell always reflects the specified
     * function applied to the input cells' values.
     * @param fn Function to apply. It must be <em>referentially transparent</em>.
     */
    lift6<B, C, D, E, F, G>(
        b: Cell<B>, c: Cell<C>, d: Cell<D>, e: Cell<E>, f: Cell<F>,
        fn0: (a: A, b: B, c: C, d: D, e: E, f: F) => G,
    ): Cell<G> {
        return this._lift6(
            fn0 as (a?: A, b?: B, c?: C, d?: D, e?: E, f?: F) => G,
            b, c, d, e, f,
        );
    }

    _lift6<B, C, D, E, F, G>(
        fn0: (a?: A, b?: B, c?: C, d?: D, e?: E, f?: F) => G,
        b?: Cell<B>, c?: Cell<C>, d?: Cell<D>, e?: Cell<E>, f?: Cell<F>,
    ): Cell<G> {
        return new Cell(undefined, undefined, new CellLift6Vertex(
            fn0,
            this.vertex,
            b?.vertex,
            c?.vertex,
            d?.vertex,
            e?.vertex,
            f?.vertex,
        ));
    }

    /**
     * High order depenency traking. If any newly created sodium objects within a value of a cell of a sodium object
     * happen to accumulate state, this method will keep the accumulation of state up to date.
     */
    public tracking(extractor: (a: A) => (Stream<any> | Cell<any>)[]): Cell<A> {
        throw new Error();
    }

    /**
     * Lift an array of cells into a cell of an array.
     */
    public static liftArray<A>(ca: ReadonlyArray<Cell<A>>): Cell<ReadonlyArray<A>> {
        return new Cell(undefined, undefined, new CellLiftArrayVertex(ca));
    }

    /**
     * Apply a value inside a cell to a function inside a cell. This is the
     * primitive for all function lifting.
     */
    static apply<A, B>(cf: Cell<(a: A) => B>, ca: Cell<A>): Cell<B> {
        return new Cell(undefined, undefined, new CellApplyVertex(cf.vertex, ca.vertex));
    }

    /**
     * Unwrap a cell inside another cell to give a time-varying cell implementation.
     */
    static switchC<A>(cca: Cell<Cell<A>>): Cell<A> {
        return new Cell(undefined, undefined, new SwitchCVertex(cca.vertex));
    }

    /**
     * Unwrap a stream inside a cell to give a time-varying stream implementation.
     */
    static switchS<A>(csa: Cell<Stream<A>>): Stream<A> {
        return new Stream(new SwitchSVertex(csa.vertex));
    }

    flatMap<R>(f: (value: A) => Cell<R>) {
        return Cell.switchC(this.map(f));
    };

    forEach<R>(f: (value: A) => R): () => void {
        const kill = this.listen(f);
        f(this.sample());
        return kill;
    };

    /**
     * When transforming a value from a larger type to a smaller type, it is likely for duplicate changes to become
     * propergated. This function insures only distinct changes get propergated.
     */
    calm(eq: (l: A, r: A) => boolean): Cell<A> {
        return new Cell(undefined, undefined, new CellCalmVertex(this.vertex, eq));
    }

    /**
     * This function is the same as calm, except you do not need to pass an eq function. This function will use (===)
     * as its eq function. I.E. calling calmRefEq() is the same as calm((a,b) => a === b).
     */
    calmRefEq(): Cell<A> {
        return this.calm((l, r) => l === r);
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
    listen(h: (a: A) => void): () => void {
        const vertex = new ListenerVertex(this.vertex, h);
        // TODO: Figure out when ref count should be increased (loops...)
        vertex.incRefCount();

        const na = this.vertex.newValue ?? this.vertex.oldValue;
        h(na);

        return () => {
            vertex.decRefCount();
        };
    }
}
