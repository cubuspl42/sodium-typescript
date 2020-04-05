import { Vertex, ListenerVertex } from './Vertex';

let enableDebugFlag = false;

function log(a: any): void {
  if (enableDebugFlag) {
    console.log(a);
  }
}

function visit(set: Set<Vertex>, vertex: Vertex) {
  if (vertex.visited) return;

  vertex.visited = true;

  vertex.dependents?.forEach((v) => {
    visit(set, v);
  });

  set.add(vertex);
}

export class Transaction {
  private roots = new Set<Vertex>();

  constructor() { }

  addRoot(root: Vertex) {
    this.roots.add(root);
  }

  close(): void {
    const dfs = (roots: Set<Vertex>): Set<Vertex> => {
      const set = new Set<Vertex>();

      roots.forEach((v) => {
        visit(set, v);
      });

      return set;
    }

    const visited = dfs(this.roots);

    Transaction.visitedVerticesCount = Math.max(visited.size, Transaction.visitedVerticesCount);

    this.roots.clear();

    // TODO: effects/update order
    visited.forEach((v) => {
      v.notify();
    });

    visited.forEach((l) => l.update());
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
