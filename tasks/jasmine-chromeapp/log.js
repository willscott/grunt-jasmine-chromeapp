/*globals console*/
var logs = [];

function captureLog(severity, log) {
  'use strict';
  logs.push([new Date(), severity, Array.prototype.slice.call(log)]);
}

// This will intercept logs and get their output back to the shell.
function captureLogs() {
  'use strict';
  console.log('Now capturing logs');
  var methods = [ 'debug', 'info', 'log', 'warn', 'error' ];
  methods.forEach(function (mthd) {
    var realMethod = 'real' + mthd,
      report = captureLog.bind({}, mthd);
    console[realMethod] = console[mthd];
    console[mthd] = function () {
      report(arguments);
      console.reallog.apply(console, arguments);
    };
  });
}

captureLogs();
