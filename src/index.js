var GitRemoteResolver = require('bower/lib/core/resolvers/GitRemoteResolver');
var createInstance = require('bower/lib/core/resolverFactory');
var stringify = require('json-stable-stringify');
var assign = require('object-assign');
var fs = require('fs');
var path = require('path');
var debuglog = require('debuglog');

require('string.prototype.endswith');

var log = debuglog('bower-shrinkwrap-resolver');

var argv = process.argv;

var resetShrinkwrap = !!~argv.indexOf('--reset-shrinkwrap');
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
if (!noShrinkwrap && !resetShrinkwrap) {
  try {
    var shrinkwrapFileContent = fs.readFileSync(shrinkwrapFile, 'utf8');
  } catch (e) {
    log('WARN: ' + e.message);
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

function logRelease(source) {
  log('INFO: Resolving ' + source + (shrinkwrap[source]
      ? ' (shrinkwrap)' : ' (remote)'));
}

function logFetch(endpoint, qualifier) {
  log('INFO: Fetching ' + endpoint.source + '#' + endpoint.target +
    (qualifier ? ' (' + qualifier + ')' : ''));
}

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
      var rc = releaseCache[source] = {};
      var sw = shrinkwrap[source];
      logRelease(source);
      if (sw && !endpointProvided) {
        // skipping normal refs resolution in favour of shrinkwrap entry
        return Object.keys(sw).map(function (key) {
          (rc[sw[key]] || (rc[sw[key]] = [])).push(key);
          return key === 'master' ? {target: 'master', version: '0.0.0'}
            : {target: sw[key], version: key};
        });
      }
      if (strictShrinkwrap) {
        throw new Error(source + ' is missing shrinkwrap entry');
      }
      var src = !source.indexOf('git+') ? source.slice(4) : source;
      return GitRemoteResolver.refs(src).then(function (refs) {
        var r = [];
        refs.forEach(function (line) {
          var match = line.match(/^([a-f0-9]{40})\s+refs\/tags\/v?(\S+)/);
          if (match && !match[2].endsWith('^{}')) {
            var tag = match[2];
            if (tag.split('.').length === 2) {
              tag += '.0'; // fixme: breaks on 0.0-0...
            }

            // rc is inverted to get correct shrinkwrap even if multiple tags
            // reference the same commit (yep, people actually do this)

            var hash = match[1];
            (rc[hash] || (rc[hash] = [])).push(tag);
            r.push({target: hash, version: tag});
          }
        });
        if (!r.length) {
          // used in case of wildcard range for repos with no tags
          r.push({target: 'master', version: '0.0.0'});
        }
        return r;
      });
    },
    fetch: function (endpoint, cached) {
      var lock = updatedShrinkwrap[endpoint.source] ||
        (updatedShrinkwrap[endpoint.source] = {});
      if (cached && cached.version) {
        var lockedVersion = cached.version;
        var lockedHash = cached.endpoint.target;
        if (cached.resolution.commit) {
          lockedVersion === '0.0.0' && (lockedVersion = cached.endpoint.target);
          lockedHash = cached.resolution.commit;
        }
        if (lockedVersion !== '0.0.0' || lockedHash !== 'master') {
          lock[lockedVersion] = lockedHash;
          return;
        }
      }
      var options = assign({}, bower, {
        config: assign({}, bower.config, {resolvers: []})
      });
      // (sha1, tag/branch)
      // can be undefined if depedency was specified using url#tag/branch syntax
      var rc = releaseCache[endpoint.source];
      var sw = shrinkwrap[endpoint.source];
      if (sw && !endpointProvided) {
        var hash = sw[endpoint.target];
        if (hash) {
          rc = {};
          var v = rc[hash] = [];
          Object.keys(sw)
            .forEach(function (k) { sw[k] === hash && v.push(k); });
          endpoint.target = sw[endpoint.target];
        }
      }
      if (rc && rc[endpoint.target]) {
        logFetch(endpoint, rc[endpoint.target].join(','));
        rc[endpoint.target].forEach(function (v) {
          lock[v] = endpoint.target;
        });
        return _();
      } else {
        if (strictShrinkwrap) {
          throw new Error(endpoint.source +
            ' is missing shrinkwrap entry for ' + endpoint.target);
        }
        // at this point endpoint.target can point to either a branch or a
        // commit hash (and so we'll try to resolve branch name & update
        // the lock)
        var src = !endpoint.source.indexOf('git+') ? endpoint.source.slice(4)
          : endpoint.source;
        return GitRemoteResolver.refs(src)
          .then(function (refs) {
            var r = {};
            refs.forEach(function (line) {
              var match = line.match(/^([a-f0-9]{40})\s+refs\/\w+\/(\S+)/);
              if (match) {
                r[match[2]] = match[1];
              }
            });
            return r;
          })
          .then(function (branches) {
            var target = branches[endpoint.target];
            if (target) {
              lock[endpoint.target] = target;
              var originalTarget = endpoint.target;
              endpoint.target = target;
              logFetch(endpoint, originalTarget);
            } else {
              logFetch(endpoint);
              lock[endpoint.target] = endpoint.target;
            }
          })
          .then(_);
      }
      function _() {
        // todo: switch tp PackageRepository
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
