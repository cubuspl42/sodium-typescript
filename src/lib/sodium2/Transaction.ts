import { Vertex } from './Vertex';

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

  private static isInTransaction: boolean = false;

  public static run<A>(f: (t?: Transaction) => A): A {
    if (this.isInTransaction) {
      throw new Error("Already in transaction");
    }

    this.isInTransaction = true;

    const t = new Transaction();

    const a = f(t);

    t.close();

    this.isInTransaction = false;

    return a;
  }
}
