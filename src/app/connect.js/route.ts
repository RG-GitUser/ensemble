// Serves the pairing script creators paste into their existing website.
// It fetches the creator's content edits and applies them to the live DOM in
// place — no containers, no styling, just text/image/video swaps.
// NOTE: keep EMBED-style template rules — no backticks/${} inside CONNECT_JS.

const CONNECT_JS = `(function () {
  "use strict";
  var script = document.currentScript;
  if (!script) return;
  var token = script.getAttribute("data-site");
  if (!token) { console.warn('[ensemble] add data-site="your-token" to the connect script tag'); return; }
  var origin;
  try { origin = new URL(script.src).origin; } catch (e) { return; }

  function apply(items) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      try {
        var el = document.querySelector(it.selector);
        if (!el) continue;
        if (it.kind === "text") {
          el.textContent = it.value;
        } else if (it.kind === "image") {
          el.removeAttribute("srcset");
          el.setAttribute("src", it.value);
        } else if (it.kind === "video") {
          var source = el.querySelector && el.querySelector("source");
          if (source) source.setAttribute("src", it.value);
          el.setAttribute("src", it.value);
          if (el.load) try { el.load(); } catch (e2) {}
        }
      } catch (e3) {}
    }
  }

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  fetch(origin + "/api/overrides/" + encodeURIComponent(token))
    .then(function (r) {
      if (!r.ok) throw new Error("ensemble overrides request failed: " + r.status);
      return r.json();
    })
    .then(function (data) { onReady(function () { apply(data.items || []); }); })
    .catch(function (err) { console.warn("[ensemble]", err); });
})();
`;

export function GET(): Response {
  return new Response(CONNECT_JS, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
