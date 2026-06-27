/* Assessment Report Builder — stable 3DX bootstrap */
(function (global, document) {
  'use strict';

  var MANIFEST_URL = '/api/widget/manifest';
  var BOOT_ERROR_ID = 'assessment-bootstrap-error';

  function setBootMessage(message, isError) {
    var root = document.getElementById('assessment-root');
    if (!root) return;
    var box = document.getElementById(BOOT_ERROR_ID);
    if (!box) {
      box = document.createElement('div');
      box.id = BOOT_ERROR_ID;
      box.style.padding = '18px';
      box.style.fontFamily = 'Arial, Helvetica, sans-serif';
      root.appendChild(box);
    }
    box.style.color = isError ? '#b42318' : '#4d5a6e';
    box.innerHTML = '<strong>Assessment Report Builder</strong><br />' + message;
  }

  function appendStylesheet(href) {
    return new Promise(function (resolve, reject) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = href;
      link.onload = resolve;
      link.onerror = function () { reject(new Error('Falha ao carregar CSS: ' + href)); };
      document.head.appendChild(link);
    });
  }

  function appendScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = src;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Falha ao carregar runtime JS: ' + src)); };
      document.head.appendChild(script);
    });
  }

  function loadManifest() {
    return fetch(MANIFEST_URL, { cache: 'no-store' }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok || body.ok === false) {
          throw new Error(body.message || body.error || 'Manifest inválido');
        }
        return body;
      });
    });
  }

  function boot() {
    setBootMessage('Carregando manifesto oficial do widget...', false);
    loadManifest()
      .then(function (manifest) {
        if (!manifest.css || !manifest.runtime) {
          throw new Error('Manifest sem css/runtime.');
        }
        setBootMessage('Carregando assets oficiais ' + manifest.build + '...', false);
        return appendStylesheet(manifest.css).then(function () {
          return appendScript(manifest.runtime);
        });
      })
      .catch(function (error) {
        setBootMessage(error.message, true);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : this, document);
