/*globals chrome*/

chrome.app.runtime.onLaunched.addListener(function () {
  'use strict';
  chrome.app.window.create('main.html', {
    id: 'helper'
  });
});
