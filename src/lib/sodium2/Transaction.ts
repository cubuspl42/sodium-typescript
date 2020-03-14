import { Vertex } from './Vertex';
import * as Collections from 'typescript-collections';

export class Entry {
  constructor(rank: Vertex, action: () => void) {
    this.rank = rank;
    this.action = action;
    this.seq = Entry.nextSeq++;
  }

  private static nextSeq: number = 0;
  rank: Vertex;
  action: () => void;
  seq: number;

  toString(): string {
    return this.seq.toString();
  }
}

export class Transaction {
  public static currentTransaction: Transaction = null;
  private static onStartHooks: (() => void)[] = [];
  private static runningOnStartHooks: boolean = false;

  constructor() { }

  inCallback: number = 0;
  private toRegen: boolean = false;

  requestRegen(): void {
    this.toRegen = true;
  }

  prioritized(target: Vertex, action: () => void): void {
    throw new Error();

  }

  sample(h: () => void): void {
    throw new Error();
  }

  last(h: () => void): void {
    throw new Error();
  }

  public static _collectCyclesAtEnd(): void {
    throw new Error();
  }

  /**
   * Add an action to run after all last() actions.
   */
  post(childIx: number, action: () => void): void {
    throw new Error();
  }

  // If the priority queue has entries in it when we modify any of the nodes'
  // ranks, then we need to re-generate it to make sure it's up-to-date.
  private checkRegen(): void {
    throw new Error();

  }

  public isActive(): boolean {
    throw new Error();
  }

  close(): void {
    throw new Error();

  }

  /**
   * Add a runnable that will be executed whenever a transaction is started.
   * That runnable may start transactions itself, which will not cause the
   * hooks to be run recursively.
   *
   * The main use case of this is the implementation of a time/alarm system.
   */
  static onStart(r: () => void): void {
    throw new Error();
  }

  public static run<A>(f: () => A): A {
    throw new Error();
  }
}
