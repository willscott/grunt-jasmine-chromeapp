/*globals describe, it, expect*/

describe('jasmine-chromeapp', function () {
  'use strict';
  it('Runs & Reports', function () {
    expect(true).toBe(true);
  });

  it('Has helper files copied appropriately', function (done) {
    window.callback = done;

    var el = document.createElement('script');
    el.src = '/scripts/helper.js';
    document.body.appendChild(el);
  });
});