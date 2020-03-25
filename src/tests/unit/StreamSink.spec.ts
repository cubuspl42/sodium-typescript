
import {
  StreamSink,
  StreamLoop,
  CellSink,
  Transaction,
  Tuple2,
  Operational,
  Cell,
  CellLoop,
  getTotalRegistrations
} from '../../lib/Lib';

function lambda1<A, B>(f: (a: A) => B, deps?: any[]): (a: A) => B {
  return f;
}

afterEach(() => {
  if (getTotalRegistrations() != 0) {
    throw new Error('listeners were not deregistered');
  }
});

test('should test map()', (done) => {
  const s = new StreamSink<number>();
  const out: number[] = [];
  const kill = s.map(a => a + 1)
    .listen(a => {
      out.push(a);
      done();
    });
  s.send(7);
  kill();

  expect([8]).toEqual(out);
});

test('should throw an error send_with_no_listener_1', () => {
  const s = new StreamSink<number>();

  try {
    s.send(7);
  } catch (e) {
    expect(e.message).toBe('send() was invoked before listeners were registered');
  }

});

test('should (not?) throw an error send_with_no_listener_2', () => {
  const s = new StreamSink<number>();
  const out: number[] = [];
  const kill = s.map(a => a + 1)
    .listen(a => out.push(a));

  s.send(7);
  kill();

  try {
    // TODO: the message below is bit misleading, need to verify with Stephen B.
    //       - "this should not throw, because once() uses this mechanism"
    s.send(9);
  } catch (e) {
    expect(e.message).toBe('send() was invoked before listeners were registered');
  }
});

test('should map_tack', (done) => {
  const s = new StreamSink<number>(),
    t = new StreamSink<string>(),
    out: number[] = [],
    kill = s.map(lambda1((a: number) => a + 1, [t]))
      .listen(a => {
        out.push(a);
        done();
      });

  s.send(7);
  t.send("banana");
  kill();

  expect(out).toEqual([8]);
});

test('should test mapTo()', (done) => {
  const s = new StreamSink<number>(),
    out: string[] = [],
    kill = s.mapTo("fusebox")
      .listen(a => {
        out.push(a);
        if (out.length === 2) {
          done();
        }
      });

  s.send(7);
  s.send(9);
  kill();

  expect(out).toEqual(['fusebox', 'fusebox']);
});

test('should do mergeNonSimultaneous', (done) => {
  const s1 = new StreamSink<number>(),
    s2 = new StreamSink<number>(),
    out: number[] = [];

  const kill = s2.orElse(s1)
    .listen(a => {
      out.push(a);
      if (out.length === 3) {
        done();
      }
    });

  s1.send(7);
  s2.send(9);
  s1.send(8);
  kill();

  expect(out).toEqual([7, 9, 8]);
});

test('should do mergeSimultaneous', (done) => {
  const s1 = new StreamSink<number>((l: number, r: number) => { return r; }),
    s2 = new StreamSink<number>((l: number, r: number) => { return r; }),
    out: number[] = [],
    kill = s2.orElse(s1)
      .listen(a => {
        out.push(a);
        if (out.length === 5) {
          done();
        }
      });

  Transaction.run<void>(() => {
    s1.send(7);
    s2.send(60);
  });
  Transaction.run<void>(() => {
    s1.send(9);
  });
  Transaction.run<void>(() => {
    s1.send(7);
    s1.send(60);
    s2.send(8);
    s2.send(90);
  });
  Transaction.run<void>(() => {
    s2.send(8);
    s2.send(90);
    s1.send(7);
    s1.send(60);
  });
  Transaction.run<void>(() => {
    s2.send(8);
    s1.send(7);
    s2.send(90);
    s1.send(60);
  });
  kill();

  expect(out).toEqual([60, 9, 90, 90, 90]);
});

test('should do coalesce', (done) => {
  const s = new StreamSink<number>((a, b) => a + b),
    out: number[] = [],
    kill = s.listen(a => {
      out.push(a);
      if (out.length === 2) {
        done();
      }
    });

  Transaction.run<void>(() => {
    s.send(2);
  });
  Transaction.run<void>(() => {
    s.send(8);
    s.send(40);
  });
  kill();

  expect([2, 48]).toEqual(out);
});

test('should test filter()', (done) => {
  const s = new StreamSink<number>(),
    out: number[] = [],
    kill = s.filter(a => a < 10)
      .listen(a => {
        out.push(a);
        if (out.length === 2) {
          done();
        }
      });

  s.send(2);
  s.send(16);
  s.send(9);
  kill();

  expect(out).toEqual([2, 9]);
});

test('should test filterNotNull()', (done) => {
  const s = new StreamSink<string>(),
    out: string[] = [],
    kill = s.filterNotNull()
      .listen(a => {
        out.push(a);
        if (out.length === 2) {
          done();
        }
      });

  s.send("tomato");
  s.send(null);
  s.send("peach");
  kill();

  expect(["tomato", "peach"]).toEqual(out);
});

test('should test merge()', (done) => {
  const sa = new StreamSink<number>(),
    sb = sa.map(x => Math.floor(x / 10))
      .filter(x => x != 0),
    sc = sa.map(x => x % 10)
      .merge(sb, (x, y) => x + y),
    out: number[] = [],
    kill = sc.listen(a => {
      out.push(a);
      if (out.length === 2) {
        done();
      }
    });

  sa.send(2);
  sa.send(52);
  kill();

  expect([2, 7]).toEqual(out);
});

test('should test loop()', (done) => {
  const sa = new StreamSink<number>(),
    sc = Transaction.run(() => {
      const sb = new StreamLoop<number>(),
        sc_ = sa.map(x => x % 10).merge(sb,
          (x, y) => x + y),
        sb_out = sa.map(x => Math.floor(x / 10))
          .filter(x => x != 0);
      sb.loop(sb_out);
      return sc_;
    }),
    out: number[] = [],
    kill = sc.listen(a => {
      out.push(a);
      if (out.length === 2) {
        done();
      }
    });

  sa.send(2);
  sa.send(52);
  kill();

  expect([2, 7]).toEqual(out);
});

test('should test gate()', (done) => {
  const s = new StreamSink<string>(),
    pred = new CellSink<boolean>(true),
    out: string[] = [],
    kill = s.gate(pred).listen(a => {
      out.push(a);
      if (out.length === 2) {
        done();
      }
    });

  s.send("H");
  pred.send(false);
  s.send('O');
  pred.send(true);
  s.send('I');
  kill();

  expect(["H", "I"]).toEqual(out);
});

test('should test collect()', (done) => {
  const ea = new StreamSink<number>(),
    out: number[] = [],
    sum = ea.collect(0, (a, s) => new Tuple2(a + s + 100, a + s)),
    kill = sum.listen(a => {
      out.push(a);
      if (out.length === 5) {
        done();
      }
    });

  ea.send(5);
  ea.send(7);
  ea.send(1);
  ea.send(2);
  ea.send(3);
  kill();

  expect([105, 112, 113, 115, 118]).toEqual(out);
});

test('should test accum()', (done) => {
  const ea = new StreamSink<number>(),
    out: number[] = [],
    sum = ea.accum(100, (a, s) => a + s),
    kill = sum.listen(a => {
      out.push(a);
      if (out.length === 6) {
        done();
      }
    });

  ea.send(5);
  ea.send(7);
  ea.send(1);
  ea.send(2);
  ea.send(3);
  kill();

  expect([100, 105, 112, 113, 115, 118]).toEqual(out);
});

test('should test once()', (done) => {
  const s = new StreamSink<string>(),
    out: string[] = [],
    kill = s.once().listen(a => {
      out.push(a);
      done();
    });

  s.send("A");
  s.send("B");
  s.send("C");
  kill();

  expect(["A"]).toEqual(out);
});

test('should test defer()', (done) => {
  const s = new StreamSink<string>(),
    c = s.hold(" "),
    out: string[] = [],
    kill = Operational.defer(s).snapshot1(c)
      .listen(a => {
        out.push(a);
        if (out.length === 3) {
          done();
        }
      });

  s.send("C");
  s.send("B");
  s.send("A");
  kill();

  expect(["C", "B", "A"]).toEqual(out);
});

test('should test hold()', (done) => {
  const s = new StreamSink<number>(),
    c = s.hold(0),
    out: number[] = [],
    kill = Operational.updates(c)
      .listen(a => {
        out.push(a);
        if (out.length === 2) {
          done();
        }
      });

  s.send(2);
  s.send(9);
  kill();

  expect(out).toEqual([2, 9]);
});

test('should do holdIsDelayed', (done) => {
  const s = new StreamSink<number>(),
    h = s.hold(0),
    sPair = s.snapshot(h, (a, b) => a + " " + b),
    out: string[] = [],
    kill = sPair.listen(a => {
      out.push(a);
      if (out.length === 2) {
        done();
      }
    });

  s.send(2);
  s.send(3);
  kill();

  expect(["2 0", "3 2"]).toEqual(out);
});

class SC {
  constructor(a: string, b: string, sw: string) {
    this.a = a;
    this.b = b;
    this.sw = sw;
  }

  a: string;
  b: string;
  sw: string;
}

function testSwitchC(done: () => void, initCsvStr: string) {
  const ssc = new StreamSink<SC>(),
    // Split each field out of SC so we can update multiple cells in a
    // single transaction.
    ca = ssc.map(s => s.a).filterNotNull().hold("A").rename("ca"),
    cb = ssc.map(s => s.b).filterNotNull().hold("a").rename("cb"),
    csw_str = ssc.map(s => s.sw).filterNotNull().hold(initCsvStr).rename("csw_str"),
    // ****
    // NOTE! Because this lambda contains references to Sodium objects, we
    // must declare them explicitly using lambda1() so that Sodium knows
    // about the dependency, otherwise it can't manage the memory.
    // ****
    csw = csw_str.map(lambda1(s => s == "ca" ? ca : cb, [ca, cb])).rename("csw"),
    co = Cell.switchC(csw).rename("co"),
    out: string[] = [],
    kill = co.listen(c => {
      out.push(c);
      if (out.length === 11) {
        done();
      }
    });

  return {
    ssc,
    out,
    kill,
  }
}

test('should test switchC()', (done) => {
  const { ssc, out, kill } = testSwitchC(done, "ca");

  ssc.send(new SC("B", "b", null));
  ssc.send(new SC("C", "c", "cb"));
  ssc.send(new SC("D", "d", null));
  ssc.send(new SC("E", "e", "ca"));
  ssc.send(new SC("F", "f", null));
  ssc.send(new SC(null, null, "cb"));
  ssc.send(new SC(null, null, "ca"));
  ssc.send(new SC("G", "g", "cb"));
  ssc.send(new SC("H", "h", "ca"));
  ssc.send(new SC("I", "i", "ca"));
  kill();


  expect(out).toEqual(["A", "B", "c", "d", "E", "F", "f", "F", "g", "H", "I"]);
});

test('should test switchC() 2', (done) => {
  const { ssc, out, kill } = testSwitchC(done, "cb");

  ssc.send(new SC("B", "b", null));
  ssc.send(new SC("C", "c", "ca"));
  ssc.send(new SC("D", "d", null));
  ssc.send(new SC("E", "e", "cb"));
  ssc.send(new SC("F", "f", null));
  ssc.send(new SC(null, null, "ca"));
  ssc.send(new SC(null, null, "cb"));
  ssc.send(new SC("G", "g", "ca"));
  ssc.send(new SC("H", "h", "cb"));
  ssc.send(new SC("I", "i", "cb"));
  kill();

  expect(out).toEqual(["a", "b", "C", "D", "e", "f", "F", "f", "G", "h", "i"]);
});

test('should test switchS()', (done) => {
  class SS {
    constructor(a: string, b: string, sw: string) {
      this.a = a;
      this.b = b;
      this.sw = sw;
    }

    a: string;
    b: string;
    sw: string;
  }

  const sss = new StreamSink<SS>(),
    sa = sss.map(s => s.a).filterNotNull().rename("sa"),
    sb = sss.map(s => s.b).filterNotNull().rename("sb"),
    csw_str = sss.map(s => s.sw).rename("sss.map").filterNotNull().hold("sa"),
    // ****
    // NOTE! Because this lambda contains references to Sodium objects, we
    // must declare them explicitly using lambda1() so that Sodium knows
    // about the dependency, otherwise it can't manage the memory.
    // ****
    csw = csw_str.map(lambda1(sw => sw == "sa" ? sa : sb, [sa, sb])).rename("csw_str.map"),
    so = Cell.switchS(csw),
    out: string[] = [],
    kill = so.listen(x => {
      out.push(x);
      if (out.length === 9) {
        done();
      }
    });

  sss.send(new SS("A", "a", null));
  sss.send(new SS("B", "b", null));
  sss.send(new SS("C", "c", "sb"));
  sss.send(new SS("D", "d", null));
  sss.send(new SS("E", "e", "sa"));
  sss.send(new SS("F", "f", null));
  sss.send(new SS("G", "g", "sb"));
  sss.send(new SS("H", "h", "sa"));
  sss.send(new SS("I", "i", "sa"));
  sss.send(new SS(null, "j", "sb"));
  sss.send(new SS("K", null, "sa"));
  sss.send(new SS("L", null, "sb"));
  sss.send(new SS(null, "m", "sa"));
  kill();

  expect(out).toEqual(["A", "B", "C", "d", "e", "F", "G", "h", "I", "j", "K", "L", "m"]);
});

test('should do switchSSimultaneous', (done) => {
  class SS2 {
    s: StreamSink<number> = new StreamSink<number>();
  }

  const ss1 = new SS2(),
    ss2 = new SS2(),
    ss3 = new SS2(),
    ss4 = new SS2(),
    css = new CellSink<SS2>(ss1),
    // ****
    // NOTE! Because this lambda contains references to Sodium objects, we
    // must declare them explicitly using lambda1() so that Sodium knows
    // about the dependency, otherwise it can't manage the memory.
    // ****
    so = Cell.switchS(css.map(lambda1((b: SS2) => b.s, [ss1.s, ss2.s, ss3.s, ss4.s]))),
    out: number[] = [],
    kill = so.listen(c => {
      out.push(c);
      if (out.length === 10) {
        done();
      }
    });

  ss1.s.send(0);
  ss1.s.send(1);
  ss1.s.send(2);
  css.send(ss2);
  ss1.s.send(7);
  ss2.s.send(3);
  ss2.s.send(4);
  ss3.s.send(2);
  css.send(ss3);
  ss3.s.send(5);
  ss3.s.send(6);
  ss3.s.send(7);
  Transaction.run(() => {
    ss3.s.send(8);
    css.send(ss4);
    ss4.s.send(2);
  });
  ss4.s.send(9);
  kill();

  expect(out).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('should test loopCell', (done) => {
  const sa = new StreamSink<number>(),
    sum_out = Transaction.run(() => {
      const sum = new CellLoop<number>(),
        sum_out_ = sa.snapshot(sum, (x, y) => x + y).hold(0);
      sum.loop(sum_out_);
      return sum_out_;
    }),
    out: number[] = [],
    kill = sum_out.listen(a => {
      out.push(a);
      if (out.length === 4) {
        done();
      }
    });

  sa.send(2);
  sa.send(3);
  sa.send(1);
  kill();

  expect([0, 2, 5, 6]).toEqual(out);
  expect(6).toBe(sum_out.sample());
});

test('should test defer/split memory cycle', done => {
  // We do not fire through sl here, as it would cause an infinite loop.
  // This is just a memory management test.
  let sl: StreamLoop<number>;
  Transaction.run(() => {
    sl = new StreamLoop<number>();
    sl.loop(Operational.defer(sl));
  });
  let kill = sl.listen(() => { });
  kill();
  done();
});
