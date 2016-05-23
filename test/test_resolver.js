/*eslint-env mocha*/

'use strict';

const assert   = require('assert');
const resolver = require('../lib/resolver');


describe('resolver', function () {
  it('simple, empty params', function () {
    assert.equal(resolver('simple')([]), '\u0001');
  });

  it('simple, non-empty params', function () {
    assert.equal(resolver('simple')([ 1, '2' ]), '1\u00022');
  });

  it('json, empty params', function () {
    assert.equal(resolver('json')([]), '\u0001');
  });

  it('json, non-empty params', function () {
    assert.equal(resolver('json')([ { x: 1 }, [ 2 ] ]), '[2]\u0002{"x":1}');
  });

  it('flex, empty', function () {
    assert.equal(resolver([ 'json' ])([]), '\u0001');
  });

  it('flex, json', function () {
    assert.equal(resolver([ 'json', 'json' ])([ { x: 1 }, [ 2 ] ]), '{"x":1}\u0002[2]');
  });

  it('flex, custom #1', function () {
    assert.equal(resolver([ Boolean, Boolean ])([ 0, 1 ]), 'false\u0002true');
  });

  it('flex, custom #2', function () {
    assert.equal(resolver([ obj => obj.x ])([ { x: 'test' } ]), 'test');
  });

  it('invalid', function () {
    assert.throws(() => {
      resolver('foo');
    }, /invalid resolve option/);
  });

  it('invalid flex', function () {
    assert.throws(() => {
      resolver([ 'foo' ]);
    }, /unknown value .* in resolve option/);
  });
});
