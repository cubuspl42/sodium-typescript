import { Vertex } from './Vertex';
import { exec } from 'child_process';

export class Transaction {
  private roots = new Set<Vertex>();

  constructor() { }

  addRoot(root: Vertex) {
    this.roots.add(root);
  }

  close(): void {
    // DFS-based topological sort

    const stack: Vertex[] = [];

    const visit = (vertex: Vertex) => {
      vertex.visited = true;

      vertex.dependents?.forEach((v) => {
        if (!v.visited) {
          visit(v);
        }
      });

      stack.push(vertex);
    };

    this.roots.forEach((v) => visit(v));

    for (let i = stack.length - 1; i >= 0; i--) {
      const vertex = stack[i];
      vertex.process();
    }

    stack.forEach((v) => v.reset());
  }

  private static currentTransaction?: Transaction;

  public static run<A>(f: (t?: Transaction) => A): A {
    const ct = this.currentTransaction;

    if (!ct) {
      const t = new Transaction();

      this.currentTransaction = t;

      const a = f(t);

      t.close();

      return a;
    } else {
      return f(ct);
    }
  }
}