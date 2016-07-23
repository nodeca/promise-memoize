'use strict';


var resolvers = {
  simple: function (args) {
    if (!args.length) return '\u0001';

    return args.join('\u0002');
  },

  json: function (args) {
    if (!args.length) return '\u0001';

    var res = [];

    for (var i = args.length - 1; i >= 0; i--) {
      res.push(JSON.stringify(args[i]));
    }

    return res.join('\u0002');
  }
};


function createFlexResolver(params) {
  params.forEach(function (p) {
    if (typeof p === 'string' && !resolvers.hasOwnProperty(p)) {
      throw new Error('promise-memoize: unknown value "' + p + '" in resolve option');
    }
  });

  return function (args) {
    var max = Math.min(params.length, args.length);

    if (!max) return '\u0001';

    var res = [];

    for (var i = 0; i < max; i++) {
      if (typeof params[i] === 'string') {
        res.push(resolvers[params[i]]([ args[i] ]));
      } else {
        res.push(params[i](args[i]));
      }
    }

    return res.join('\u0002');
  };
}


module.exports = function createResolver(how) {
  if (typeof how === 'undefined') return resolvers.simple;

  if (typeof how === 'string' && resolvers.hasOwnProperty(how)) return resolvers[how];

  if (Array.isArray(how)) return createFlexResolver(how);

  if (Object.prototype.toString.call(how) === '[object Function]') return how;

  throw new Error('promise-memoize: invalid resolve option');
};
