'use strict';


var resolver = require('./resolver');


module.exports = function promiseMemoize(fn, options) {
  var cache       = {},
      opt         = options || {},
      resolve     = resolver(opt.resolve),
      maxAge      = opt.maxAge || 0,
      maxErrorAge = opt.maxErrorAge || 0;

  function createCacheObj(result, args) {
    return {
      result:         result,
      args:           args,
      expire_id:      0,
      prefetch_id:    0,
      need_prefetch:  false
    };
  }

  function destroyCacheObj(key) {
    clearTimeout(cache[key].expire_id);
    clearTimeout(cache[key].prefetch_id);

    delete cache[key];
  }

  function askPrefetch(key) {
    cache[key].need_prefetch = true;
  }

  function doPrefetch(key) {
    var result = fn.apply(null, cache[key].args);

    cache[key].need_prefetch = false;

    // On success - substitute data & restart tracker.
    // On fail - do nothing, data will be killed by expiration timer.
    result.then(function () {
      if (!cache[key]) return; // Safeguard, if .clear() happens while fetch

      cache[key].result = result;
      clearTimeout(cache[key].expire_id);

      /*eslint-disable no-use-before-define*/
      trackCacheObj(key);
    });
  }

  function trackCacheObj(key) {
    // Wait for data & start timers, depending on result & options
    cache[key].result.then(
      function () {
        if (!cache[key]) return; // Safeguard, if .clear() happens while fetch

        if (!maxAge) return;

        // Such call will not work in IE9 without polyfill.
        // https://developer.mozilla.org/docs/Web/API/WindowTimers/setTimeout
        cache[key].expire_id = setTimeout(destroyCacheObj, maxAge, key);
        cache[key].prefetch_id = setTimeout(askPrefetch, maxAge * 0.7, key);
      },
      function () {
        if (!cache[key]) return; // Safeguard, if .clear() happens while fetch

        if (!maxErrorAge) {
          destroyCacheObj(key);
          return;
        }

        // Don't try to prefetch on error, for simplicity
        cache[key].expire_id = setTimeout(destroyCacheObj, maxErrorAge, key);
      }
    );
  }


  function memoizedFn() {
    var args = new Array(arguments.length);

    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    var key = resolve(args);

    if (cache[key]) {
      if (cache[key].need_prefetch) doPrefetch(key);

      return cache[key].result;
    }

    cache[key] = createCacheObj(fn.apply(null, args),
      maxAge || maxErrorAge ? args : null); // Store args only if needed

    trackCacheObj(key);

    return cache[key].result;
  }

  memoizedFn.clear = function () {
    var keys = Object.keys(cache);

    keys.forEach(function (key) { destroyCacheObj(key); });
    cache = {};

    return keys.length; // Number of cleared keys, useful for tests
  };

  return memoizedFn;
};
