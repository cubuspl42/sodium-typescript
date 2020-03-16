import { Stream } from "./Stream";
import { Cell } from "./Cell";


export function lambda1<A, B>(f: (a: A) => B,
    deps: Array<Stream<any> | Cell<any>>): (a: A) => B {
    return f;
}

export function lambda2<A, B, C>(f: (a: A, b: B) => C,
    deps: Array<Stream<any> | Cell<any>>): (a: A, b: B) => C {
    return f;
}

export function lambda3<A, B, C, D>(f: (a: A, b: B, c: C) => D,
    deps: Array<Stream<any> | Cell<any>>): (a: A, b: B, c: C) => D {
    return f;
}

export function lambda4<A, B, C, D, E>(f: (a: A, b: B, c: C, d: D) => E,
    deps: Array<Stream<any> | Cell<any>>): (a: A, b: B, c: C, d: D) => E {
    return f;
}

export function lambda5<A, B, C, D, E, F>(f: (a: A, b: B, c: C, d: D, e: E) => F,
    deps: Array<Stream<any> | Cell<any>>): (a: A, b: B, c: C, d: D, e: E) => F {
    return f;
}


export function lambda6<A, B, C, D, E, F, G>(f: (a: A, b: B, c: C, d: D, e: E, f: F) => G,
    deps: Array<Stream<any> | Cell<any>>): (a: A, b: B, c: C, d: D, e: E, f: F) => G {
    return f;
}
