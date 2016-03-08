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

`bower install` (with parameters or not) will automatically generate `bower-shrinkwrap.json`. You don't need 
 to do anything special. When bower detects that some of the versions are locked - it will use that instead
 of issuing network request(s). 
 
If you wish bower to ignore shrinkwrap file - pass `--no-shrinkwrap` command 
 line parameter (e.g. `bower i --no-shrinkwrap`)

## License

[MIT License](https://github.com/shyiko/bower-shrinkwrap-resolver/blob/master/mit.license)
