/*eslint-env mocha*/

'use strict';

const assert  = require('assert');
const co      = require('co');
const memoize = require('../');


describe('promise-memoize', function () {
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
    yield sleep(15);
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

    yield sleep(40);
    assert.equal(yield memoized(123), 0, 'assert #3');
    assert.equal(yield memoized(123), 0, 'assert #4');
    assert.equal(counter.value, 1);

    yield sleep(40); // 80+ msec, prefetch should run here
    assert.equal(yield memoized(123), 0, 'assert #5');
    assert.equal(counter.value, 1); // still 1, 'cause updating next tick

    yield sleep(40); // 120+ msec
    assert.equal(counter.value, 2);
    assert.equal(yield memoized(123), 1, 'assert #6');
    assert.equal(yield memoized(123), 1, 'assert #7');
    assert.equal(counter.value, 2);
  }));

  it('should throw on wrong resolver', function () {
    assert.throws(() => {
      memoize(counter, { resolve: 'foo' });
    });
  });
});
