/*globals describe, it, expect*/

describe('jasmine-chromeapp', function () {
  'use strict';
  it('Runs & Reports', function () {
    expect(true).toBe(true);
  });

  it('Has helper files copied appropriately', function (done) {
    var el = document.createElement('script');

    window.callback = function (included) {
      expect(included).toBe(true);
      delete window.callback;

      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }

      done();
    };

    el.addEventListener('error', window.callback, true);
    el.src = '/scripts/test/helper.js';
    document.body.appendChild(el);
  });
});