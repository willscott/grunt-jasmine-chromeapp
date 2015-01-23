# grunt-jasmine-chromeapp

> Run jasmine specs in a Chrome Packaged App


Getting Started
---------------

This plugin requires Grunt ```~0.4.0```

If you haven't used Grunt before, be sure to check out the Getting Started guide, which explains how to create your grunt file.
Once you're familiar with the process, this plugin can be installed as:

```shell
npm install grunt-jasmine-chromeapp --save-dev
```

Once the plugin has been installed, it may be enabled with this line of JavaScript:
```javascript
grunt.loadNpmTasks('grunt-jasmine-chromeapp');
```

Jasmine Task
------------

Run this task with the ```grunt jasmine_chromeapp``` command.

Automatically builds and maintains the spec runner and reports results back to the grunt console.
Uses selenium with custom arguments to the chrome-driver to start an instance of chrome running
the dynamically constructed chrome app package. The package reports results back to a web server
run by the plugin, which then reports back to the console. This is because Selenium cannot actually
control a running chrome packaged app, due to the web-driver implementation.

Customize your SpecRunner
-------------------------

Use your own files in the app to customize your tests. 


### Options

#### src
Type: `String|Array`

Your source files and specs. These are the files you are testing.

#### options.helpers
Type: `String|Array`

Additional non-source helper files which will be present, but not automatically included.

#### options.keepRunner
Type: `Boolean`
Default: `false`

Prevents the auto-generated app from being automatically deleted, and leave the browser open.

#### options.timeout
Type: `Number`
Default: `30000`

How many milliseconds to wait for the browser to start up before failing.

#### options.outfile
Type: `String`
Default: `.build`

The directory to stage the chrome app into.
