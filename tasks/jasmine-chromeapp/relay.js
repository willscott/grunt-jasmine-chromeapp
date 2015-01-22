/*globals jsApiReporter */
var port = 9999,
  pollInterval;

// This code sends the report.
function send() {
  'use strict';
  var req = new XMLHttpRequest(),
    specs = jsApiReporter.specs(),
    payload = JSON.stringify(specs);

  req.open('post', 'http://localhost:' + port + '/put', true);
  req.send(payload);
}

// This will run periodically to see if the testing is done.
function report() {
  'use strict';

  if (jsApiReporter.finished) {
    send();
    window.clearInterval(pollInterval);
  }
}
pollInterval = window.setInterval(report, 300);

window.addEventListener('load', function () {
  'use strict';
  var scripts = document.getElementsByTagName('script'),
    i = 0,
    req = new XMLHttpRequest();

  // Determine if the port has been overridden by the test.
  for (i = 0; i < scripts.length; i += 1) {
    if (scripts[i].src.indexOf('relay.js') > -1) {
      port = parseInt(scripts[i].src.substr(scripts[i].src.indexOf('?port=') + 6), 10);
      break;
    }
  }

  req.open('get', 'http://localhost:' + port + '/ready', true);
  req.send();
}, true);
