/*jslint node:true */

module.exports = function (grunt) {
  'use strict';

  var http = require('http'),
    chalk = require('chalk'),
    path = require('path'),
    async = require('async'),
    fs = require('fs-extra'),
    pkg = require('../package.json'),
    chrome = require('../lib/launch-chrome');

  function addFiles(files, to, tagFilter) {
    var tags = '';

    files.forEach(function (file) {
      file.src.forEach(function (f) {
        var dest;
        if (file.dest && grunt.file.isDir(file.dest)) {
          dest = f;
        } else {
          dest = file.dest || f;
        }
        if (grunt.file.isFile(f)) {
          if (grunt.file.isMatch(tagFilter, f)) {
            tags += "<script type='text/javascript' src='scripts/" + dest + "'></script>\n";
          }
          grunt.file.copy(f, to + '/scripts/' + dest);
        }
      });
    });

    return tags;
  }

  function buildSpec(ctx, next) {
    grunt.log.write('Building...');
    grunt.file.mkdir(ctx.outfile);
    var dest = ctx.outfile,
      tags = "";

    // Copy the template
    grunt.file.recurse(ctx.template, function (file, root, dir, filename) {
      grunt.file.copy(file, dest + '/' + filename);
    });
    // Copy Jasmine
    grunt.file.recurse(__dirname + '/../vendor/jasmine-core-' + ctx.version,
      function (file, root, dir, filename) {
        if (!dir) {
          dir = '';
        }
        grunt.file.copy(file, dest + '/jasmine-core/' + dir + '/' + filename);
      });
    // Make a profile directory.
    grunt.file.mkdir(ctx.outfile + '/profile');

    // Copy user files.
    if (!ctx.paths) {
      ctx.paths = grunt.file.expand(ctx.files[0].src);
    }
    tags += addFiles(ctx.files, dest, ctx.paths);

    tags += "<script type='text/javascript' src='relay.js?port=" + ctx.port + "'></script>";

    // Update the template with found specs.
    tags = grunt.file.read(dest + '/main.html') + tags;
    grunt.file.write(dest + '/main.html', tags);

    grunt.log.writeln(chalk.green('Done.'));
    next();
  }

  function startReporter(ctx, next) {
    ctx.cleanupTimeout = setTimeout(cleanup.bind({}, ctx), ctx.timeout);
    grunt.log.write('Starting Reporter...');

    ctx.messages = [];
    ctx.inprogress = '';
    ctx.web = http.createServer(function (req, res) {
      if (req.url === '/') {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end('<html>' +
                'Reporting server for grunt-jasmine-chromeapp.' +
                '</html>');
      } else if (req.url === '/put') {
        req.setEncoding('utf8');
        req.on('data', function (chunk) {
          ctx.inprogress += chunk;
        });
        req.on('end', function () {
          ctx.messages.push(ctx.inprogress);
          ctx.inprogress = '';
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(ctx.keepRunner? 'thanks!': 'kill');
          if (ctx.onMessage) {
            ctx.onMessage();
          }
        });
      } else if (req.url === '/ready') {
        grunt.log.writeln(chalk.green('Done.'));
        res.end('Okay.');
        if (ctx.onMessage) {
          ctx.onMessage();
        }
      }
    }).listen(ctx.port);

    grunt.log.writeln(chalk.green('Done.'));
    next();
  }

  function startChrome(ctx, next) {
    grunt.log.write('Starting Chrome...');
    ctx.onMessage = next;

    if (process.platform === "darwin") {
      ctx.flags = ctx.flags.concat("--no-startup-window");
    }

    ctx.chrome = chrome([
        "--no-first-run",
        "--force-app-mode",
        "--apps-keep-chrome-alive-in-tests",
        "--load-and-launch-app=" + ctx.outfile,
        "--user-data-dir=" + ctx.outfile + '/profile'
    ].concat(ctx.flags), ctx.binary);
  }

  function testPoll(ctx, cb) {
    if (ctx.messages.length > 0) {
      cb();
    } else {
      setTimeout(testPoll.bind({}, ctx, cb), 500);
    }
  }

  function runTests(ctx, next) {
    grunt.log.write('Running Tests...');
    clearTimeout(ctx.cleanupTimeout);
    ctx.onMessage = function () {
      grunt.log.writeln(chalk.green('Done.'));
      next();
    };
  }

  function finishTests(ctx, next) {
    grunt.log.write('Reporting on Tests...');
    testPoll(ctx, function (ctx) {
      grunt.log.writeln(chalk.green('Done.'));
      var parse = JSON.parse(ctx.messages[0]),
        spec,
        i = 0;

      ctx.status = {failed: 0};
      for (i = 0; i < parse.length; i += 1) {
        spec = parse[i];
        if (process.stdout.clearLine) {
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
          if (spec.status === 'passed') {
            grunt.log.writeln(chalk.green.bold('✓') + '\t' + spec.fullName);
          } else if (spec.status === 'failed') {
            ctx.status.failed += 1;
            grunt.log.writeln(chalk.red.bold('X') + '\t' + spec.fullName);
          } else {
            grunt.log.writeln(chalk.yellow.bold('*') + '\t' + spec.fullName);
          }
        } else {
          if (spec.status === 'passed') {
            grunt.log.writeln('✓' + spec.fullName);
          } else if (spec.status === 'failed') {
            ctx.status.failed += 1;
            grunt.log.writeln('X' + spec.fullName);
          } else {
            grunt.log.writeln('*' + spec.fullName);
          }
        }
      }
      next();
    }.bind({}, ctx));
  }

  function cleanup(ctx, next) {
    var good = true;
    if (ctx.cleanupTimeout) {
      clearTimeout(ctx.cleanupTimeout);
    }
    if (!next) {
      next = ctx.done;
    }
    if (!ctx.status) {
      grunt.log.error(chalk.red('Timed out'));
      good = false;
    } else if (ctx.status.failed === 0) {
      grunt.log.ok(chalk.green('0 failures'));
    } else {
      grunt.log.error(chalk.red(ctx.status.failed + ' failures'));
      good = false;
    }
    if (ctx.keepRunner) {
      ctx.chrome.on('close', function () {
        grunt.file['delete'](ctx.outfile);
        ctx.web.close();
        next(good || new Error('One or more tests failed.'));
      });
      return;
    }

    ctx.web.close();
    if (ctx.chrome) {
      ctx.chrome.on('close', function () {
        grunt.file['delete'](ctx.outfile);
      });
      ctx.chrome.kill();
    } else {
      grunt.file['delete'](ctx.outfile);
    }

    next(good || new Error('One or more tests failed.'));
  }

  grunt.registerMultiTask('jasmine_chromeapp', pkg.description, function () {
    var done = this.async(),
      name = this.target,
      ctx = this.options({
        template: __dirname + '/../tasks/jasmine-chromeapp',
        version: '2.0.0',
        outfile: '.build',
        paths: undefined,
        binary: undefined,
        keepRunner: false,
        port: 9989,
        timeout : 30000,
        flags: []
      });

    if (grunt.option('debug')) {
      grunt.log.debug(JSON.stringify(ctx));
    }

    ctx.files = this.files;
    ctx.done = done;

    process.on('SIGINT', function () {
      cleanup(ctx);
    });

    async.series([
      async.apply(buildSpec, ctx),
      async.apply(startReporter, ctx),
      async.apply(startChrome, ctx),
      async.apply(runTests, ctx),
      async.apply(finishTests, ctx),
      async.apply(cleanup, ctx)
    ], function (good) {
      ctx.done(good);
    });
  });
};
