import { Source, Vertex_ } from "./Vertex";

export class Listener<A> {
    constructor(h : (a : A) => void, target : Vertex_) {
        this.h = h;
        this.target = target;
    }
    h : (a : A) => void;
    target : Vertex_;
}
