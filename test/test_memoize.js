/*eslint-env mocha*/

'use strict';

var memoize = require('../');
var Promise = require('any-promise');
var chai    = require('chai');

chai.use(require('chai-as-promised'));

var assert = chai.assert;

describe('memoize', function () {
  function counter() {
    return new Promise(function (resolve) {
      process.nextTick(function () { resolve(counter.value++); });
    });
  }

  function rejecter() {
    return new Promise(function (resolve, reject) {
      process.nextTick(function () { reject(rejecter.value++); });
    });
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(function () { resolve(); }, ms);
    });
  }

  beforeEach(function () {
    counter.value = 0;
    rejecter.value = 0;
  });

  it('should memoize functions', function () {
    var memoized = memoize(counter);

    return Promise.resolve()
      .then(function () {
        return assert.becomes(memoized(1, 2), 0, 'assert A #1');
      })
      .then(function () {
        return assert.becomes(memoized(1, 2), 0, 'assert A #2');
      })
      .then(function () {
        return assert.becomes(memoized(3, 4), 1, 'assert B #1');
      })
      .then(function () {
        return assert.becomes(memoized(1, 2), 0, 'assert A #3');
      })
      .then(function () {
        return assert.becomes(memoized(3, 4), 1, 'assert B #2');
      })
      .then(function () {
        return assert.becomes(memoized(),     2, 'assert C #1');
      });
  });

  it('should keep different caches for differently split string as args', function () {
    var memoized = memoize(counter);

    return Promise.resolve()
      .then(function () {
        return assert.becomes(memoized('foo', 'bar'), 0, 'assert #1');
      })
      .then(function () {
        return assert.becomes(memoized('fo', 'obar'), 1, 'assert #2');
      });
  });

  it('should not cache errors by default', function () {
    var memoized = memoize(rejecter);
    var i = 0;

    return Promise.resolve()
      .then(function () {
        return memoized(1, 2).catch(function (err) {
          i++;
          assert.equal(err, 0, 'assert A #1');
        });
      })
      .then(function () {
        return memoized(1, 2).catch(function (err) {
          i++;
          assert.equal(err, 1, 'assert A #2');
        });
      })
      .then(function () {
        assert.equal(i, 2);
      });
  });

  it('should accept complex arguments', function () {
    var memoized = memoize(counter, { resolve: 'json' });

    return Promise.resolve()
      .then(function () {
        return assert.becomes(memoized({ x: 1 }, [ 'foo' ]), 0, 'assert A #1');
      })
      .then(function () {
        return assert.becomes(memoized({ x: 1 }, [ 'foo' ]), 0, 'assert A #2');
      })
      .then(function () {
        return assert.becomes(memoized({ x: 2 }, [ 'foo' ]), 1, 'assert B #1');
      })
      .then(function () {
        return assert.becomes(memoized({ x: 1 }, [ 'bar' ]), 2, 'assert C #1');
      })
      .then(function () {
        return assert.becomes(memoized({ x: 1 }, [ 'foo' ]), 0, 'assert A #3');
      })
      .then(function () {
        return assert.becomes(memoized({ x: 2 }, [ 'foo' ]), 1, 'assert B #2');
      });
  });

  it('should be reset on .clear()', function () {
    var memoized = memoize(counter);

    return Promise.resolve()
      .then(function () {
        return assert.becomes(memoized(1, 2), 0, 'assert A #1');
      })
      .then(function () {
        return assert.becomes(memoized(1, 2), 0, 'assert A #2');
      })
      .then(function () {
        memoized.clear();
        return assert.becomes(memoized(1, 2), 1, 'assert A #3');
      });
  });

  it('should respect maxAge', function () {
    var memoized = memoize(counter, { maxAge: 10 });

    return Promise.resolve()
      .then(function () {
        return assert.becomes(memoized(123), 0, 'assert A #1');
      })
      .then(function () {
        return assert.becomes(memoized(123), 0, 'assert A #2');
      })
      .then(function () {
        return sleep(50);
      })
      .then(function () {
        assert.equal(memoized.clear(), 0); // cache should expire
      })
      .then(function () {
        return assert.becomes(memoized(123), 1, 'assert A #3');
      })
      .then(function () {
        return assert.becomes(memoized(123), 1, 'assert A #4');
      })
      .then(function () {
        assert.equal(memoized.clear(), 1); // cache should be dirty
      });
  });

  it('should respect maxErrorAge', function () {
    var memoized = memoize(rejecter, { maxErrorAge: 10 });
    var i = 0;

    return Promise.resolve()
      .then(function () {
        return memoized(1, 2).catch(function (err) {
          i++;
          assert.equal(err, 0, 'assert A #1');
        });
      })
      .then(function () {
        return memoized(1, 2).catch(function (err) {
          i++;
          assert.equal(err, 0, 'assert A #2');
        });
      })
      .then(function () {
        return sleep(50);
      })
      .then(function () {
        return memoized(1, 2).catch(function (err) {
          i++;
          assert.equal(err, 1, 'assert A #3');
        });
      })
      .then(function () {
        return memoized(1, 2).catch(function (err) {
          i++;
          assert.equal(err, 1, 'assert A #4');
        });
      })
      .then(function () {
        assert.equal(i, 4);
      });
  });

  it('should accept resolve function', function () {
    var memoized = memoize(counter, {
      resolve: function (args) { return args[0].x + args[1][0]; }
    });

    return Promise.resolve()
      .then(function () {
        return assert.becomes(memoized({ x: 1 }, [ 1, 2, 3 ]), 0, 'assert A #1');
      })
      .then(function () {
        return assert.becomes(memoized({ x: 2 }, [ 1, 2, 3 ]), 1, 'assert B #1');
      })
      .then(function () {
        return assert.becomes(memoized({ x: 1 }, [ 2, 2, 3 ]), 1, 'assert C #1');
      })
      .then(function () {
        return assert.becomes(memoized({ x: 1 }, [ 1, 4, 5 ]), 0, 'assert A #2');
      });
  });

  it('should run prefetch', function () {
    var memoized = memoize(counter, { maxAge: 100 });

    return Promise.resolve()
      .then(function () {
        return assert.becomes(memoized(123), 0, 'assert #1');
      })
      .then(function () {
        return assert.becomes(memoized(123), 0, 'assert #2');
      })

      // check that prefetch does not run after just 40 msec
      .then(function () {
        return sleep(40);
      })
      .then(function () {
        return assert.becomes(memoized(123), 0, 'assert #3');
      })
      .then(function () {
        return assert.becomes(memoized(123), 0, 'assert #4');
      })
      .then(function () {
        assert.equal(counter.value, 1);
      })

      // check that prefetch runs after 80 msec
      .then(function () {
        return sleep(40); // 80+ msec
      })
      .then(function () {
        return assert.becomes(memoized(123), 0, 'assert #5');
      })
      .then(function () {
        assert.equal(counter.value, 1); // still 1, 'cause updating next tick
      })
      .then(function () {
        return sleep(40); // 120+ msec
      })
      .then(function () {
        assert.equal(counter.value, 2);
      })

      // make sure prefetched result stays in cache
      .then(function () {
        return assert.becomes(memoized(123), 1, 'assert #6');
      })
      .then(function () {
        return assert.becomes(memoized(123), 1, 'assert #7');
      })
      .then(function () {
        assert.equal(counter.value, 2);
      });
  });

  it('coverage - clear after fetch (succeeded)', function () {
    var memoized = memoize(counter, { maxAge: 10 }), p;

    p = memoized(123);
    memoized.clear();
    return p; // check that it doesn't throw TypeError
  });

  it('coverage - clear after fetch (errored)', function () {
    var memoized = memoize(rejecter, { maxErrorAge: 10 }), p;

    p = memoized(123);
    memoized.clear();

    // check that it doesn't throw TypeError
    return p.catch(function (err) {
      assert.equal(err, 0, 'assert #1');
    });
  });

  it('coverage - clear after fetch (prefetch)', function () {
    var memoized = memoize(counter, { maxAge: 50 }), p;

    return Promise.resolve()
      .then(function () {
        return memoized(123);
      })
      .then(function () {
        return sleep(40);
      })
      .then(function () {
        p = memoized(123); // prefetch here
        memoized.clear();
        return p; // check that it doesn't throw TypeError
      });
  });
});
