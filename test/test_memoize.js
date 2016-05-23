/*eslint-env mocha*/

'use strict';

const assert  = require('assert');
const co      = require('co');
const memoize = require('../');


describe('memoize', function () {
  function counter() {
    return new Promise(resolve => {
      process.nextTick(() => resolve(counter.value++));
    });
  }

  function rejecter() {
    return new Promise((resolve, reject) => {
      process.nextTick(() => reject(rejecter.value++));
    });
  }

  function sleep(ms) {
    return new Promise(resolve => {
      setTimeout(() => resolve(), ms);
    });
  }

  beforeEach(function () {
    counter.value = 0;
    rejecter.value = 0;
  });

  it('should memoize functions', co.wrap(function* () {
    let memoized = memoize(counter);

    assert.equal(yield memoized(1, 2), 0, 'assert A #1');
    assert.equal(yield memoized(1, 2), 0, 'assert A #2');
    assert.equal(yield memoized(3, 4), 1, 'assert B #1');
    assert.equal(yield memoized(1, 2), 0, 'assert A #3');
    assert.equal(yield memoized(3, 4), 1, 'assert B #2');
    assert.equal(yield memoized(),     2, 'assert C #1');
  }));

  it('should keep different caches for differently split string as args', co.wrap(function* () {
    let memoized = memoize(counter);

    assert.equal(yield memoized('foo', 'bar'), 0, 'assert #1');
    assert.equal(yield memoized('fo', 'obar'), 1, 'assert #2');
  }));

  it('should not cache errors by default', co.wrap(function* () {
    let memoized = memoize(rejecter);
    let i = 0;

    try { yield memoized(1, 2); } catch (err) { i++; assert.equal(err, 0, 'assert A #1'); }
    try { yield memoized(1, 2); } catch (err) { i++; assert.equal(err, 1, 'assert A #3'); }

    assert.equal(i, 2);
  }));

  it('should accept complex arguments', co.wrap(function* () {
    let memoized = memoize(counter, { resolve: 'json' });

    assert.equal(yield memoized({ x: 1 }, [ 'foo' ]), 0, 'assert A #1');
    assert.equal(yield memoized({ x: 1 }, [ 'foo' ]), 0, 'assert A #2');
    assert.equal(yield memoized({ x: 2 }, [ 'foo' ]), 1, 'assert B #1');
    assert.equal(yield memoized({ x: 1 }, [ 'bar' ]), 2, 'assert C #1');
    assert.equal(yield memoized({ x: 1 }, [ 'foo' ]), 0, 'assert A #3');
    assert.equal(yield memoized({ x: 2 }, [ 'foo' ]), 1, 'assert B #2');
  }));

  it('should be reset on .clear()', co.wrap(function* () {
    let memoized = memoize(counter);

    assert.equal(yield memoized(1, 2), 0, 'assert A #1');
    assert.equal(yield memoized(1, 2), 0, 'assert A #2');
    memoized.clear();
    assert.equal(yield memoized(1, 2), 1, 'assert A #3');
  }));

  it('should respect maxAge', co.wrap(function* () {
    let memoized = memoize(counter, { maxAge: 10 });

    assert.equal(yield memoized(123), 0, 'assert A #1');
    assert.equal(yield memoized(123), 0, 'assert A #2');
    yield sleep(50);
    assert.equal(memoized.clear(), 0); // cache should expire
    assert.equal(yield memoized(123), 1, 'assert A #3');
    assert.equal(yield memoized(123), 1, 'assert A #4');
    assert.equal(memoized.clear(), 1); // cache should be dirty
  }));

  it('should respect maxErrorAge', co.wrap(function* () {
    let memoized = memoize(rejecter, { maxErrorAge: 10 });
    let i = 0;

    try { yield memoized(1, 2); } catch (err) { i++; assert.equal(err, 0, 'assert A #1'); }
    try { yield memoized(1, 2); } catch (err) { i++; assert.equal(err, 0, 'assert A #2'); }
    yield sleep(50);
    try { yield memoized(1, 2); } catch (err) { i++; assert.equal(err, 1, 'assert A #3'); }
    try { yield memoized(1, 2); } catch (err) { i++; assert.equal(err, 1, 'assert A #4'); }

    assert.equal(i, 4);
  }));

  it('should accept resolve function', co.wrap(function* () {
    let memoized = memoize(counter, {
      resolve: args => args[0].x + args[1][0]
    });

    assert.equal(yield memoized({ x: 1 }, [ 1, 2, 3 ]), 0, 'assert A #1');
    assert.equal(yield memoized({ x: 2 }, [ 1, 2, 3 ]), 1, 'assert B #1');
    assert.equal(yield memoized({ x: 1 }, [ 2, 2, 3 ]), 1, 'assert C #1');
    assert.equal(yield memoized({ x: 1 }, [ 1, 4, 5 ]), 0, 'assert A #2');
  }));

  it('should run prefetch', co.wrap(function* () {
    let memoized = memoize(counter, { maxAge: 100 });

    assert.equal(yield memoized(123), 0, 'assert #1');
    assert.equal(yield memoized(123), 0, 'assert #2');

    // check that prefetch does not run after just 40 msec
    yield sleep(40);
    assert.equal(yield memoized(123), 0, 'assert #3');
    assert.equal(yield memoized(123), 0, 'assert #4');
    assert.equal(counter.value, 1);

    // check that prefetch runs after 80 msec
    yield sleep(40); // 80+ msec
    assert.equal(yield memoized(123), 0, 'assert #5');
    assert.equal(counter.value, 1); // still 1, 'cause updating next tick
    yield sleep(40); // 120+ msec
    assert.equal(counter.value, 2);

    // make sure prefetched result stays in cache
    assert.equal(yield memoized(123), 1, 'assert #6');
    assert.equal(yield memoized(123), 1, 'assert #7');
    assert.equal(counter.value, 2);
  }));

  it('coverage - clear after fetch (succeeded)', co.wrap(function* () {
    let memoized = memoize(counter, { maxAge: 10 }), p;

    p = memoized(123);
    memoized.clear();
    yield p; // check that it doesn't throw TypeError
  }));

  it('coverage - clear after fetch (errored)', co.wrap(function* () {
    let memoized = memoize(rejecter, { maxErrorAge: 10 }), p;

    p = memoized(123);
    memoized.clear();

    // check that it doesn't throw TypeError
    try { yield p; } catch (err) { assert.equal(err, 0, 'assert #1'); }
  }));

  it('coverage - clear after fetch (prefetch)', co.wrap(function* () {
    let memoized = memoize(counter, { maxAge: 50 }), p;

    yield memoized(123);
    yield sleep(40);
    p = memoized(123); // prefetch here
    memoized.clear();
    yield p; // check that it doesn't throw TypeError
  }));
});
