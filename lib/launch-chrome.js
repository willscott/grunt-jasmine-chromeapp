/*jslint node:true */
/**
 * This file exports a function which will launch chrome with a given set of
 * command line options. It attempts to use platform-specific locations for
 * chrome, with the same expressiveness as chrome-driver, based on the search
 * locatiosn chrome-driver lists at
 * https://code.google.com/p/selenium/wiki/ChromeDriver
 */

var childProcess = require('child_process'),
  fs = require('fs');

module.exports = function (options) {
  'use strict';
  if (/^win/.test(process.platform)) {
    //Windows
    var homeLoc = process.env('HOMEPATH') +
        '\\Local Settings\\Application Data\\Google\\Chrome\\Application\\chrome.exe';
    if (fs.existsSync(homeLoc)) {
      return childProcess.spawn(homeLoc, options);
    } else {
      return childProcess.spawn(process.env('USERPROFILE') +
          '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe', options);
    }
  } else if (process.platform === "darwin") {
    //Mac
    return childProcess.spawn("/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome", options);
  } else {
    //Linux
    return childProcess.spawn("/usr/bin/google-chrome", options);
  }
};
