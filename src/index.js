var GitRemoteResolver = require('bower/lib/core/resolvers/GitRemoteResolver');
var createInstance = require('bower/lib/core/resolverFactory');
var stringify = require('json-stable-stringify');
var assign = require('object-assign');
var fs = require('fs');
var path = require('path');
var util = require('util');

require('string.prototype.endswith');

var log = util.debuglog('bower-shrinkwrap-resolver');

var forceShrinkwrap = !!~process.argv.indexOf('--force-shrinkwrap');
var noShrinkwrap = !!~process.argv.indexOf('--no-shrinkwrap');

var shrinkwrapFile = path.join(process.cwd(), 'bower-shrinkwrap.json');

var shrinkwrap = {};
if (!noShrinkwrap || forceShrinkwrap) {
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
  if (!status && !noShrinkwrap) {
    fs.writeFileSync(shrinkwrapFile, stringify(updatedShrinkwrap,
      {space: '  '}), 'utf8');
  }
});

module.exports = function resolver(bower) {
  return {
    match: function (source) {
      log('INFO: Matching ' + source);
      return !!~source.indexOf('://');
    },
    /**
     * NOTE: this method is not going to be invoked unless "target" is a valid
     * semver range.
     */
    releases: function (source) {
      var sw = shrinkwrap[source];
      log('INFO: Resolving ' + source + (sw ? ' (shrinkwrap)' : ' (remote)'));
      var rc = releaseCache[source] || (releaseCache[source] = {});
      if (sw) {
        return Object.keys(sw).map(function (key) {
          rc[key] = sw[key];
          return {
            target: key, version: sw[key] === 'master' ? '0.0.0' : sw[key]
          };
        });
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
      log('INFO: Fetching ' + JSON.stringify(endpoint));
      var options = assign({}, bower, {
        config: assign({}, bower.config, {resolvers: []})
      });
      var lock = updatedShrinkwrap[endpoint.source] ||
        (updatedShrinkwrap[endpoint.source] = {});
      var rc = releaseCache[endpoint.source];
      if (rc && rc[endpoint.target]) {
        lock[endpoint.target] = rc[endpoint.target];
        return _();
      } else {
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
              log('INFO: ' + endpoint.target + ' -> ' + target + ' ' +
                JSON.stringify(endpoint));
              lock[target] = endpoint.target;
              endpoint.target = target;
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
