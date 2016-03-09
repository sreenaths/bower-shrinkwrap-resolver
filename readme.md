# bower-shrinkwrap-resolver

Missing shrinkwrap for Bower.

## Integration

1. (within project directory) `npm install bower-shrinkwrap-resolver --save-dev`
2. Add `bower-shrinkwrap-resolver` [resolver](http://bower.io/docs/pluggable-resolvers) to `.bowerrc`, like so:
```json 
{
  "resolvers": [
    "bower-shrinkwrap-resolver"
  ]
}
```

That's it.

## Usage

`bower install` (with or without parameters) will automatically generate (and update) `bower-shrinkwrap.json`.  

**CLI**
* `--no-shrinkwrap` - ignore an available shrinkwrap file.
* `--strict-shrinkwrap` - fail if bower tries to install dependency that is missing in `bower-shrinkwrap.json`.
* `--force-shrinkwrap` - regenerate `bower-shrinkwrap.json` 
(e.g. `bower i --force-shrinkwrap` is equivalent to `rm bower-shrinkwrap.json && bower i`).

## License

[MIT License](https://github.com/shyiko/bower-shrinkwrap-resolver/blob/master/mit.license)
