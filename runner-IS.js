/*! iron-runner.js | copyright 2025 daniel2gg */
(function () {
  'use strict';

  // --------------------------
  // Transpiler: IronScript -> JavaScript
  // --------------------------
  function transpileIS(code) {
    if (typeof code !== 'string') return '';

    // 1) normalize line endings
    code = code.replace(/\r\n?/g, '\n');

    // 2) remove wrappers (non-greedy)
    code = code.replace(/public\s+variable\s*\{\s*([\s\S]*?)\s*\}\s*,?/gi, '$1');
    code = code.replace(/public\s+script\s*\{\s*([\s\S]*?)\s*\}\s*,?/gi, '$1');

    // 3) type mappings (simple regex-based)
    code = code.replace(/elem\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g, 'const $1 = $2;');
    code = code.replace(/need\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g, 'const $1 = $2;');
    code = code.replace(/string\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g, 'let $1 = $2;');
    code = code.replace(/int\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g, 'let $1 = $2;');
    code = code.replace(/bool\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g, 'let $1 = $2;');
    code = code.replace(/array\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g, 'let $1 = $2;');
    code = code.replace(/object\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g, 'let $1 = $2;');

    // 4) komentar line-start `## ...` atau inline `##...`
    code = code.replace(/(^|\n)\s*##(.*?)(?=\n|$)/g, '$1// $2');

    // 5) printLog -> console.log
    code = code.replace(/printLog\s*\(([\s\S]*?)\)/g, 'console.log($1)');

    // 6) Replace $_var$ -> ${var} but only inside backticks
    //    We find backtick sequences and replace inside them.
    code = code.replace(/`([\s\S]*?)`/g, function (m, inner) {
      return '`' + inner.replace(/\$_([A-Za-z0-9_.$]+)\$/g, '${$1}') + '`';
    });

    // 7) Events: event targetName { ... }  =>  targetName = () => { ... };
    code = code.replace(/event\s+([\w.$]+)\s*\{\s*([\s\S]*?)\s*\}/gi, function (m, target, body) {
      return `${target} = () => {\n${body}\n};`;
    });

    // 8) small helper addition (join)
    const helpers = 'function join(){ return Array.from(arguments).join(""); }\n';

    return helpers + code;
  }

  // --------------------------
  // Run JS safely (as new Function)
  // --------------------------
  function runJS(jsCode, originInfo) {
    try {
      // new Function executes in global scope similar to eval but is slightly cleaner
      // Still executes arbitrary code — user must understand the risk.
      (new Function(jsCode))();
    } catch (err) {
      console.error('iron-runner: error executing transpiled IS script', originInfo || '', err);
    }
  }

  // --------------------------
  // Run IS from string
  // --------------------------
  function runIS(code, originInfo) {
    try {
      const jsCode = transpileIS(code);
      runJS(jsCode, originInfo);
    } catch (err) {
      console.error('iron-runner: error transpiling/running IS', originInfo || '', err);
    }
  }

  // --------------------------
  // Fetch and run IS from URL
  // --------------------------
  function runISFromUrl(url) {
    return fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText);
        return res.text();
      })
      .then(function (text) {
        runIS(text, url);
      })
      .catch(function (err) {
        console.error('iron-runner: failed to load IS from', url, err);
      });
  }

  // --------------------------
  // Process all <script type="iron"> in document order
  // --------------------------
  (function processIronScripts() {
    const nodeList = document.querySelectorAll('script[type="iron"]');
    if (!nodeList || nodeList.length === 0) return;

    // Convert NodeList -> Array to preserve static order even if DOM changes
    const scripts = Array.prototype.slice.call(nodeList);

    // Run sequentially: if a script has src, wait for fetch+run before next
    (async function runSequentially() {
      for (const s of scripts) {
        try {
          const src = s.getAttribute('src');
          if (src) {
            // allow data- attributes for future options (e.g. data-async)
            const isAsync = s.hasAttribute('data-async');
            if (isAsync) {
              // don't await; run in background
              runISFromUrl(src);
            } else {
              // await fetch+run to preserve order
              // relative URLs resolved by browser
              await runISFromUrl(src);
            }
          } else {
            // inline content: use textContent (preserves raw text)
            const code = s.textContent || '';
            runIS(code, 'inline <script type="iron">');
          }
        } catch (err) {
          console.error('iron-runner: error processing script', s, err);
        }
      }
    })();
  })();

  // expose API (optional) for programmatic use:
  // window.iron = { transpileIS, runIS, runISFromUrl }
  if (typeof window !== 'undefined') {
    window.iron = window.iron || {};
    window.iron.transpileIS = transpileIS;
    window.iron.runIS = runIS;
    window.iron.runISFromUrl = runISFromUrl;
  }
})();
