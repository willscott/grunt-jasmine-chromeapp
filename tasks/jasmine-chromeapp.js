/*jslint node:true */

module.exports = function (grunt) {
  'use strict';

  var selenium = require('selenium-standalone'),
    http = require('http'),
    chalk = require('chalk'),
    driver = require('wd').promiseChainRemote(),
    path = require('path'),
    async = require('async'),
    fs = require('fs-extra'),
    pkg = require('../package.json');

  function addFiles(files, to) {
    var tags = '';

    files.forEach(function (file) {
      if (grunt.file.isFile(file)) {
        tags += "<script type='text/javascript' src='scripts/" + file + "'></script>\n";
        grunt.file.copy(file, to + '/scripts/' + file);
      }
    });

    return tags;
  }

  function buildSpec(ctx, next) {
    grunt.log.write('Building...');
    grunt.file.mkdir(ctx.outfile);
    var dest = ctx.outfile,
      srcs = grunt.file.expand(ctx.src),
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
    tags += addFiles(srcs, dest);
    if (ctx.helpers) {
      addFiles(grunt.file.expand(ctx.helpers), dest);
    }
    
    tags += "<script type='text/javascript' src='relay.js?port=" + ctx.port + "'></script>";

    // Update the template with found specs.
    tags = grunt.file.read(dest + '/main.html') + tags;
    grunt.file.write(dest + '/main.html', tags);

    grunt.log.writeln(chalk.green('Done.'));
    next();
  }

  function installSelenium(ctx, next) {
    grunt.log.write('Checking / Installing Selenium...');
    
    // Install if starting fails.
    selenium.start(function (err, child) {
      if (err) {
        selenium.install(next);
      } else {
        child.kill();
        next();
      }
    });
  }

  function startSelenium(ctx, next) {
    grunt.log.writeln(chalk.green('Done.'));
    ctx.cleanupTimeout = setTimeout(cleanup.bind({}, ctx), ctx.timeout);
    grunt.log.write('Starting Selenium...');

    selenium.start({
      spawnOptions: {
        //stdio: 'pipe'
      },
      seleniumArgs: [
        '-debug'
      ]
    }, function (err, child) {
      if (err) {
        grunt.fail.warn(err);
      }
      ctx.server = child;
      grunt.log.writeln(chalk.green('Done.'));
      next();
    });
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
          res.end('Okay.');
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
  }

  function startDriver(ctx, next) {
    grunt.log.write('Starting Browser...');
    ctx.onMessage = next;
    ctx.driver = driver.init({
      browserName: 'chrome',
      chromeOptions: {
        args: [
          "--load-and-launch-app=" + ctx.outfile,
          "--user-data-dir=" + ctx.outfile + '/profile'
        ]
      }
    });
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
      return next(good || new Error('One or more tests failed.'));
    }

    grunt.file['delete'](ctx.outfile);
    ctx.driver.quit();
    ctx.web.close();
    setTimeout(function () {
      if (ctx.server) {
        ctx.server.kill();
      }
    }, 500);
    setTimeout(function () {
      next(good || new Error('One or more tests failed.'));
    }, 1000);
  }

  grunt.registerMultiTask('jasmine_chromeapp', pkg.description, function () {
    var done = this.async(),
      name = this.target,
      ctx = this.options({
        template: __dirname + '/../tasks/jasmine-chromeapp',
        version: '2.0.0',
        outfile: '.build',
        helpers: undefined,
        keepRunner: false,
        port: 9989,
        timeout : 30000
      });

    if (grunt.option('debug')) {
      grunt.log.debug(JSON.stringify(ctx));
    }

    ctx.src = this.filesSrc;
    ctx.done = done;
    
    process.on('SIGINT', function () {
      cleanup(ctx);
    });

    async.series([
      async.apply(buildSpec, ctx),
      async.apply(installSelenium, ctx),
      async.apply(startSelenium, ctx),
      async.apply(startDriver, ctx),
      async.apply(runTests, ctx),
      async.apply(finishTests, ctx),
      async.apply(cleanup, ctx)
    ], function (good) {
      ctx.done(good);
    });
  });
};
