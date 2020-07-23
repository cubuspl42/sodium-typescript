import {Vertex, ListenerVertex} from './Vertex';

let enableDebugFlag = false;

function log(a: any): void {
  if (enableDebugFlag) {
    console.log(a);
  }
}

class Set_<A> {
  private readonly array: Array<A | undefined> = [];

  private _size = 0;

  get size(): number {
    return this._size;
  }

  add(a: A): void {
    if (this._size < this.array.length) {
      this.array[this._size] = a;
      this._size++;
    } else {
      this.array.push(a);
      this._size = this.array.length;
    }
  }

  forEach(f: (a: A) => void) {
    const array = this.array;
    const size = this.size;

    for (let i = 0; i < size; ++i) {
      f(array[i]!);
    }
  }

  clear(): void {
    const array = this.array;
    const size = this.size;

    for (let i = 0; i < size; ++i) {
      array[i] = undefined;
    }

    this._size = 0;
  }
}

function _visit(set: Set_<Vertex>, vertex: Vertex): void {
  if (vertex.visited) return;

  vertex.visited = true;

  vertex.dependents?.forEach((v) => {
    _visit(set, v);
  });

  set.add(vertex);
}

export class Transaction {
  private roots = new Set<Vertex>();

  private effects = new Set<() => void>();

  private static visited = new Set_<Vertex>();

  constructor() {
  }

  addRoot(root: Vertex) {
    this.roots.add(root);
  }

  addEffect(effect: () => void) {
    this.effects.add(effect);
  }

  visit(v: Vertex): void {
      _visit(Transaction.visited, v);
  }

  close(): void {
    const dfs = (roots: Set<Vertex>): Set_<Vertex> => {
      roots.forEach((v) => {
          this.visit(v);
      });
      return Transaction.visited;
    }

    const visited = dfs(this.roots);

    Transaction.visitedVerticesCount = Math.max(visited.size, Transaction.visitedVerticesCount);

    this.roots.clear();

    visited.forEach((v) => {
      v.process();
    });

    visited.forEach((v) => {
      v.postprocess();
    });

    visited.forEach((l) => l.update());

    this.effects.forEach((effect) => effect());

    Transaction.visited.clear();
  }

  static visitedVerticesCount = 0;

  static currentTransaction?: Transaction;

  static enableDebug(flag: boolean) {
    enableDebugFlag = flag;
  }

  static log(msg: () => any): void {
    if (enableDebugFlag) {
      console.log(msg());
    }
  }

  public static run<A>(f: (t: Transaction) => A): A {
    const ct = this.currentTransaction;

    if (!ct) {
      log(`Transaction start`);

      const t = new Transaction();

      this.currentTransaction = t;

      try {
        const a = f(t);

        t.close();

        return a;
      } finally {
        this.currentTransaction = undefined;

        log(`Transaction end`);
      }
    } else {
      return f(ct);
    }
  }
}
