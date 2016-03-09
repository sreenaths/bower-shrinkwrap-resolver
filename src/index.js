var GitRemoteResolver = require('bower/lib/core/resolvers/GitRemoteResolver');
var createInstance = require('bower/lib/core/resolverFactory');
var stringify = require('json-stable-stringify');
var assign = require('object-assign');
var fs = require('fs');
var path = require('path');
var util = require('util');

require('string.prototype.endswith');

var log = util.debuglog('bower-shrinkwrap-resolver');

var argv = process.argv;

var forceShrinkwrap = !!~argv.indexOf('--force-shrinkwrap');
var noShrinkwrap = !!~argv.indexOf('--no-shrinkwrap');
var strictShrinkwrap = !!~argv.indexOf('--strict-shrinkwrap');
var endpointProvided = ['install', 'i', 'uninstall', 'rm', 'unlink', 'update']
  .some(function (c) {
    var index = argv.indexOf(c);
    if (~index) {
      var endpoint = argv[index + 1];
      return endpoint && endpoint.indexOf('-');
    }
  });

var shrinkwrapFile = path.join(process.cwd(), 'bower-shrinkwrap.json');

var shrinkwrap = {};
if (!noShrinkwrap && !forceShrinkwrap) {
  try {
    var shrinkwrapFileContent = fs.readFileSync(shrinkwrapFile, 'utf8');
  } catch (e) {
    log('ERROR: ' + e.message);
  }
  if (shrinkwrapFileContent) {
    shrinkwrap = JSON.parse(shrinkwrapFileContent);
  }
}

var updatedShrinkwrap = JSON.parse(JSON.stringify(shrinkwrap));

var releaseCache = {};

process.on('exit', function (status) {
  if (!status && !noShrinkwrap && !strictShrinkwrap) {
    log('INFO: Updating ' + shrinkwrapFile);
    fs.writeFileSync(shrinkwrapFile, stringify(updatedShrinkwrap,
      {space: '  '}), 'utf8');
  } else {
    log('INFO: Skipping update of ' + shrinkwrapFile);
  }
});

module.exports = function resolver(bower) {
  return {
    match: function (source) {
      return !!~source.indexOf('://');
    },
    /**
     * NOTE: this method is not going to be invoked unless "target" is a valid
     * semver range.
     */
    releases: function (source) {
      var rc = releaseCache[source] || (releaseCache[source] = {});
      var sw = shrinkwrap[source];
      log('INFO: Resolving ' + source + (sw ? ' (shrinkwrap)' : ' (remote)'));
      if (sw && !endpointProvided) {
        return Object.keys(sw).map(function (key) {
          rc[sw[key]] = key;
          return key === 'master' ? {target: 'master', version: '0.0.0'}
            : {target: sw[key], version: key};
        });
      }
      if (strictShrinkwrap) {
        throw new Error(source + ' is missing shrinkwrap entry');
      }
      return GitRemoteResolver.refs(source).then(function (refs) {
        var r = [];
        refs.forEach(function (line) {
          var match = line.match(/^([a-f0-9]{40})\s+refs\/tags\/v?(\S+)/);
          if (match && !match[2].endsWith('^{}')) {
            if (match[2].split('.').length === 2) {
              match[2] += '.0'; // fixme: breaks on 0.0-0...
            }
            rc[match[1]] = match[2];
            r.push({target: match[1], version: match[2]});
          }
        });
        if (!r.length) {
          r.push({target: 'master', version: '0.0.0'});
        }
        return r;
      });
    },
    fetch: function (endpoint, cached) {
      if (cached && cached.version) {
        return;
      }
      var options = assign({}, bower, {
        config: assign({}, bower.config, {resolvers: []})
      });
      var lock = updatedShrinkwrap[endpoint.source] ||
        (updatedShrinkwrap[endpoint.source] = {});
      var rc = releaseCache[endpoint.source]; // key - sha1, value - tag/branch
      var sw = shrinkwrap[endpoint.source];
      if (sw && !endpointProvided) {
        if (sw[endpoint.target]) {
          rc = {};
          rc[sw[endpoint.target]] = endpoint.target;
          endpoint.target = sw[endpoint.target];
        }
      }
      log('INFO: Fetching ' + endpoint.source + '#' + endpoint.target);
      if (rc && rc[endpoint.target]) {
        lock[rc[endpoint.target]] = endpoint.target;
        return _();
      } else {
        if (strictShrinkwrap) {
          throw new Error(endpoint.source +
            ' is missing shrinkwrap entry for ' + endpoint.target);
        }
        return GitRemoteResolver.refs(endpoint.source)
          .then(function (refs) {
            var r = {};
            refs.forEach(function (line) {
              var match = line.match(/^([a-f0-9]{40})\s+refs\/heads\/(\S+)/);
              if (match) {
                r[match[2]] = match[1];
              }
            });
            return r;
          })
          .then(function (branches) {
            var target = branches[endpoint.target];
            if (target) {
              log('INFO: Branch ' + endpoint.target + ' resolved to ' + target +
                ' ' + endpoint.source);
              lock[endpoint.target] = target;
              endpoint.target = target;
            } else {
              lock[endpoint.target] = endpoint.target;
            }
          })
          .then(_);
      }
      // todo: latch onto the ongoing promise of "endpoint.target + '@' +
      // endpoint.source" (if any)
      function _() {
        return createInstance(endpoint, options, null)
          .then(function (resolver) {
            return resolver.resolve();
          })
          .then(function (dir) {
            return {tempPath: dir, removeIgnores: true};
          });
      }
    }
  };
};
