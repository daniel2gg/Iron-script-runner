/*! iron-runner.js | copyright 2025 daniel2gg */
(function () {
  'use strict';

  // --------------------------
  // Transpiler: IronScript -> JavaScript (fixed)
  // --------------------------
  function transpileIS(code) {
    if (typeof code !== 'string') return '';

    // normalize line endings
    code = code.replace(/\r\n?/g, '\n');

    // remove wrappers (non-greedy) - allow optional trailing commas/semicolons
    code = code.replace(/public\s+variable\s*\{\s*([\s\S]*?)\s*\}\s*[,;]?/gi, '$1');
    code = code.replace(/public\s+script\s*\{\s*([\s\S]*?)\s*\}\s*[,;]?/gi, '$1');

    // basic type mappings (elem/need -> const, others -> let)
    code = code.replace(/elem\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g, 'const $1 = $2;');
    code = code.replace(/need\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g, 'const $1 = $2;');
    code = code.replace(/string\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g, 'let $1 = $2;');
    code = code.replace(/int\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g, 'let $1 = $2;');
    code = code.replace(/bool\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g, 'let $1 = $2;');
    code = code.replace(/array\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g, 'let $1 = $2;');
    code = code.replace(/object\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g, 'let $1 = $2;');

    // comments: line-start or inline "##"
    code = code.replace(/(^|\n)\s*##(.*?)(?=\n|$)/g, '$1// $2');

    // printLog -> console.log
    code = code.replace(/printLog\s*\(([\s\S]*?)\)/g, 'console.log($1)');

    // Replace $_var$ -> ${var} only inside backticks (keep other text intact)
    code = code.replace(/`([\s\S]*?)`/g, function (m, inner) {
      return '`' + inner.replace(/\$_([A-Za-z0-9_.$]+)\$/g, '${$1}') + '`';
    });

    // ---- Event handling fixes ----
    // 1) assignment-style:  <target> = event <handlerName> { ... } 
    //    -> <target> = function <handlerName>() { ... };
    code = code.replace(
      /([\s\S]*?)\b=\s*event\s+([A-Za-z_]\w*)\s*\{\s*([\s\S]*?)\s*\}\s*;?/gi,
      function (m, lhs, handlerName, body) {
        // trim lhs whitespace
        const left = lhs.trim();
        return `${left} = function ${handlerName}(){\n${body}\n};`;
      }
    );

    // 2) expression-style: event document.querySelector("x").onclick { ... }
    //    -> document.querySelector("x").onclick = function(){ ... };
    code = code.replace(
      /event\s+([A-Za-z0-9_.$\(\)\[\]\"'\s:>\/\\+-]+?)\s*\{\s*([\s\S]*?)\s*\}\s*;?/gi,
      function (m, targetExpr, body) {
        const t = targetExpr.trim();
        // if targetExpr looks like a plain identifier (no dot/parens) we still assign a var
        return `${t} = function(){\n${body}\n};`;
      }
    );

    // 3) named handler: event handlerName { ... } -> handlerName = function(){ ... };
    code = code.replace(
      /(^|\n)\s*event\s+([A-Za-z_]\w*)\s*\{\s*([\s\S]*?)\s*\}\s*;?/gi,
      function (m, nl, name, body) {
        return `\n${name} = function(){\n${body}\n};`;
      }
    );

    // small helper (join)
    const helpers = 'function join(){ return Array.from(arguments).join(""); }\n';

    return helpers + code;
  }

  // --------------------------
  // Run JS safely (new Function)
  // --------------------------
  function runJS(jsCode, originInfo) {
    try {
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
  // Fetch and run IS from URL (returns Promise)
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
  // Process <script type="iron"> after DOM ready
  // --------------------------
  function processIronScripts() {
    const nodeList = document.querySelectorAll('script[type="iron"]');
    if (!nodeList || nodeList.length === 0) return;

    const scripts = Array.prototype.slice.call(nodeList);

    (async function runSequentially() {
      for (const s of scripts) {
        try {
          const src = s.getAttribute('src');
          const isAsync = s.hasAttribute('data-async');
          if (src) {
            if (isAsync) {
              // fire-and-forget
              runISFromUrl(src);
            } else {
              // await to preserve order
              await runISFromUrl(src);
            }
          } else {
            // inline: use textContent to preserve raw text (no HTML decoding)
            const code = s.textContent || '';
            runIS(code, 'inline <script type="iron">');
          }
        } catch (err) {
          console.error('iron-runner: error processing script', s, err);
        }
      }
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processIronScripts);
  } else {
    // DOM already ready
    setTimeout(processIronScripts, 0);
  }

  // expose small API
  if (typeof window !== 'undefined') {
    window.iron = window.iron || {};
    window.iron.transpileIS = transpileIS;
    window.iron.runIS = runIS;
    window.iron.runISFromUrl = runISFromUrl;
  }
})();  // --------------------------
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
