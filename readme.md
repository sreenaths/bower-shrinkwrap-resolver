# bower-shrinkwrap-resolver-ext

A fork of shyiko/bower-shrinkwrap-resolver with some enhancements.

## Integration

> Bower must be >= **1.5** (tested on Bower 1.7.7).

1. (within project directory) `npm install bower-shrinkwrap-resolver-ext --save-dev`
2. Add `bower-shrinkwrap-resolver-ext` [resolver](http://bower.io/docs/pluggable-resolvers) to `.bowerrc`, like so:
```json 
{
  "resolvers": [
    "bower-shrinkwrap-resolver-ext"
  ]
}
```

That's it.

> If `bower` is installed globally - `bower-shrinkwrap-resolver-ext` have to `npm i -g ...` too.
  Otherwise you'll get `Cannot find module 'bower-shrinkwrap-resolver-ext'`. 

## Usage

`bower install` (with or without parameters) will automatically generate (and update) `bower-shrinkwrap.json`.  

**CLI**
* `--no-shrinkwrap` - ignore an available shrinkwrap file.
* `--strict-shrinkwrap` - fail if bower tries to install dependency that is missing in `bower-shrinkwrap.json`.
* `--reset-shrinkwrap` - regenerate `bower-shrinkwrap.json` 
(e.g. `bower i --reset-shrinkwrap` is equivalent to `rm bower-shrinkwrap.json && bower i`).

> Debug logging can be turned with `NODE_DEBUG=bower-shrinkwrap-resolver-ext bower ...`.

## License

[MIT License](https://github.com/sreenaths/bower-shrinkwrap-resolver-ext/blob/master/mit.license)
