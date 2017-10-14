'use strict';


var resolver = require('./resolver');

////////////////////////////////////////////////////////////////////////////////
// Helpers

function _toTrue()  { return true; }
function _toFalse() { return false; }

function pSuccess(promise) { return promise.then(_toTrue, _toFalse); }

function _pass(data) { return data; }
function _throw(err) { throw err; }

function ensurePromise(thenable) {
  return thenable.then(_pass, _throw);
}

////////////////////////////////////////////////////////////////////////////////

function createCacheObj(result, args) {
  return {
    result:         result,
    args:           args,
    expire_id:      0,
    prefetch_id:    0,
    need_prefetch:  false
  };
}


function destroyCacheObj(cache, key) {
  if (!cache[key]) return; // Safeguard

  clearTimeout(cache[key].expire_id);
  clearTimeout(cache[key].prefetch_id);

  delete cache[key];
}


function askPrefetch(cache, key) {
  if (!cache[key]) return; // Safeguard

  cache[key].need_prefetch = true;
}


function _track_proceed(args) {
  // args = [ pSuccess(cache[key].result), cache, key, config ]
  var success = args[0],
      cache   = args[1],
      key     = args[2],
      config  = args[3];

  if (!cache[key]) return; // Safeguard, if .clear() happens while fetch

  if (success) {

    if (!config.maxAge) return;

    // Such call will not work in IE9 without polyfill.
    // https://developer.mozilla.org/docs/Web/API/WindowTimers/setTimeout
    cache[key].expire_id   = setTimeout(destroyCacheObj, config.maxAge, cache, key);
    cache[key].prefetch_id = setTimeout(askPrefetch, config.maxAge * 0.7, cache, key);

    /* istanbul ignore else */
    if (cache[key].expire_id.unref) cache[key].expire_id.unref();

    /* istanbul ignore else */
    if (cache[key].prefetch_id.unref) cache[key].prefetch_id.unref();

    return;
  }

  // on fail

  if (!config.maxErrorAge) {
    destroyCacheObj(cache, key);
    return;
  }

  // Don't try to prefetch on error, for simplicity
  cache[key].expire_id = setTimeout(destroyCacheObj, config.maxErrorAge, cache, key);

  /* istanbul ignore else */
  if (cache[key].expire_id.unref) cache[key].expire_id.unref();

}


// Wait for data & start timers, depending on result & options
function trackCacheObj(cache, key, config) {
  var P = cache[key].result.constructor;

  P.all([
    pSuccess(cache[key].result),
    cache,
    key,
    config
  ])
    .then(_track_proceed);
}


function _prefetch_proceed(args) {
  // args = [ pSuccess(cache[key].result), cache, key, config, [ result ] ]
  var success = args[0],
      cache   = args[1],
      key     = args[2],
      config  = args[3],
      result  = args[4][0];

  if (!cache[key]) return; // Safeguard, if .clear() happens while fetch

  if (!success) return;

  cache[key].result = result;
  clearTimeout(cache[key].expire_id);

  /*eslint-disable no-use-before-define*/
  trackCacheObj(cache, key, config);
}


function doPrefetch(cache, key, config) {
  var result = ensurePromise(config.fn.apply(null, cache[key].args)),
      P      = result.constructor;

  cache[key].need_prefetch = false;

  // On success - substitute data & restart tracker.
  // On fail - do nothing, data will be killed by expiration timer.
  P.all([
    pSuccess(result),
    cache,
    key,
    config,
    [ result ] // protect from resolve
  ])
    .then(_prefetch_proceed);
}


module.exports = function promiseMemoize(fn, options) {
  var cache       = {},
      _options    = options || {},
      resolve     = resolver(_options.resolve),
      config      = {
        fn:          fn,
        maxAge:      _options.maxAge || 0,
        maxErrorAge: _options.maxErrorAge || 0
      };

  function memoizedFn() {
    var args = new Array(arguments.length);

    for (var i = 0; i < args.length; i++) args[i] = arguments[i];

    var key = resolve(args);

    if (cache[key]) {
      if (cache[key].need_prefetch) doPrefetch(cache, key, config);

    } else {
      cache[key] = createCacheObj(
        ensurePromise(config.fn.apply(null, args)),
        config.maxAge || config.maxErrorAge ? args : null // Store args only if needed
      );
      trackCacheObj(cache, key, config);
    }

    return cache[key].result;
  }

  memoizedFn.clear = function () {
    var keys = Object.keys(cache);

    keys.forEach(function (key) { destroyCacheObj(cache, key); });

    return keys.length; // Number of cleared keys, useful for tests
  };

  return memoizedFn;
};
