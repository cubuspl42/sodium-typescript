import { Vertex } from './Vertex';
import { exec } from 'child_process';

let enableDebugFlag = true;

function log(a: any): void {
  if (enableDebugFlag) {
    console.log(a);
  }
}

export class Transaction {
  private roots = new Set<Vertex>();

  constructor() { }

  addRoot(root: Vertex) {
    this.roots.add(root);
  }

  close(): void {
    let roots = this.roots;
    // DFS-based topological sort

    const stack: Vertex[] = [];

    const desc = (vertex: Vertex) => {
      return `${vertex.constructor.name} [${vertex?.name || "unnamed"}]`;
    }

    const visit = (vertex: Vertex) => {
      log(`Visiting vertex ${desc(vertex)}`);

      vertex.visited = true;

      vertex.dependents?.forEach((v) => {
        if (!v.visited) {
          visit(v);
        }
      });

      stack.push(vertex);
    };

    log({ roots: this.roots });

    this.roots.forEach((v) => {
      log(`Visiting new root!`);
      visit(v);
    });

    log({ stack: stack.map(desc).reverse() });

    for (let i = stack.length - 1; i >= 0; i--) {
      const vertex = stack[i];
      vertex.process();
    }

    stack.forEach((v) => v.reset());

    this.roots.clear();
  }

  static currentTransaction?: Transaction;

  static enableDebug(flag: boolean) {
    enableDebugFlag = flag;
  }

  public static run<A>(f: (t?: Transaction) => A): A {
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
