// Serves the drop-in embed script external websites paste in. Everything the
// script needs ships inline (CSS included) — no other assets, no dependencies.
// NOTE: keep this file free of backticks/${} inside EMBED_JS (it's a template literal).

const CSS = [
  ".ens{--ens-accent:__ACCENT__;color:#1a1a1f;line-height:1.6;font-family:inherit}",
  ".ens.ens-dark{color:#f2f2f5}",
  ".ens h1,.ens h2,.ens h3,.ens p{margin:0}",
  ".ens-section{margin:0 0 2.75rem}",
  ".ens-hero{text-align:center;padding:1rem 0}",
  ".ens-hero h1{font-size:2.4rem;font-weight:800;line-height:1.15;letter-spacing:-.02em}",
  ".ens-hero p{margin:.9rem auto 0;max-width:36rem;opacity:.75;font-size:1.05rem}",
  ".ens-h{font-size:1.5rem;font-weight:700;margin-bottom:1.1rem}",
  ".ens-btn{display:inline-block;margin-top:1.3rem;padding:.7rem 1.6rem;border-radius:.8rem;background:var(--ens-accent);color:#fff!important;font-weight:600;text-decoration:none;border:0;cursor:pointer;font-size:1rem}",
  ".ens-btn:hover{opacity:.9}",
  ".ens-card{display:block;border:1px solid rgba(0,0,0,.14);border-radius:1rem;padding:1rem 1.15rem;margin-bottom:.8rem;text-decoration:none;color:inherit}",
  ".ens-dark .ens-card{border-color:rgba(255,255,255,.2)}",
  "a.ens-card:hover{border-color:var(--ens-accent)}",
  ".ens-card b{display:block}",
  ".ens-card span{opacity:.65;font-size:.92em}",
  ".ens-about{display:flex;gap:1.4rem;align-items:flex-start;flex-wrap:wrap}",
  ".ens-about img{width:8.5rem;height:8.5rem;object-fit:cover;border-radius:1rem;flex-shrink:0}",
  ".ens-about p{opacity:.8;white-space:pre-line;flex:1;min-width:14rem}",
  ".ens-linklist a{display:block;text-align:center;border:1px solid rgba(0,0,0,.14);border-radius:.8rem;padding:.8rem;margin-bottom:.7rem;font-weight:600;text-decoration:none;color:inherit}",
  ".ens-dark .ens-linklist a{border-color:rgba(255,255,255,.2)}",
  ".ens-linklist a:hover{border-color:var(--ens-accent)}",
  ".ens-grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))}",
  ".ens-merch-item{border:1px solid rgba(0,0,0,.14);border-radius:1rem;overflow:hidden}",
  ".ens-dark .ens-merch-item{border-color:rgba(255,255,255,.2)}",
  ".ens-merch-item>img{width:100%;aspect-ratio:1;object-fit:cover;display:block}",
  ".ens-merch-ph{width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.06);font-size:.9rem;opacity:.7}",
  ".ens-dark .ens-merch-ph{background:rgba(255,255,255,.08)}",
  ".ens-merch-body{padding:.8rem .9rem 1rem}",
  ".ens-merch-row{display:flex;justify-content:space-between;gap:.5rem;font-weight:600}",
  ".ens-merch-body .ens-btn{display:block;text-align:center;margin-top:.7rem;padding:.5rem}",
  ".ens-soon{display:block;text-align:center;margin-top:.7rem;padding:.5rem;border:1px solid rgba(0,0,0,.14);border-radius:.6rem;opacity:.6;font-size:.9rem}",
  ".ens-dark .ens-soon{border-color:rgba(255,255,255,.2)}",
  ".ens-video{aspect-ratio:16/9;width:100%;border:0;border-radius:1rem}",
  ".ens-nl{border:1px solid rgba(0,0,0,.14);border-radius:1.25rem;padding:1.6rem;text-align:center}",
  ".ens-dark .ens-nl{border-color:rgba(255,255,255,.2)}",
  ".ens-nl p{opacity:.75;margin-top:.4rem}",
  ".ens-nl-form{display:flex;gap:.6rem;max-width:26rem;margin:1.1rem auto 0;flex-wrap:wrap}",
  ".ens-nl-form input{flex:1;min-width:12rem;padding:.65rem .9rem;border:1px solid rgba(0,0,0,.2);border-radius:.7rem;font:inherit;background:transparent;color:inherit}",
  ".ens-dark .ens-nl-form input{border-color:rgba(255,255,255,.25)}",
  ".ens-nl-form .ens-btn{margin-top:0}",
  ".ens-center{text-align:center}",
  ".ens-note{opacity:.65;font-size:.95rem}",
  ".ens-powered{text-align:center;font-size:.8rem;opacity:.5;margin-top:1.5rem}",
  ".ens-powered a{color:inherit}",
].join("");

const EMBED_JS = `(function () {
  "use strict";
  var script = document.currentScript;
  if (!script) return;
  var token = script.getAttribute("data-site");
  if (!token) { console.warn('[ensemble] add data-site="your-token" to the embed script tag'); return; }
  var origin;
  try { origin = new URL(script.src).origin; } catch (e) { return; }
  var dark = script.getAttribute("data-theme") === "dark";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function safeUrl(u) {
    if (!u) return "";
    try {
      var p = new URL(u, document.baseURI);
      if (p.protocol === "http:" || p.protocol === "https:" || p.protocol === "mailto:") return p.href;
    } catch (e) {}
    return "";
  }
  function attr(u) { return esc(safeUrl(u)); }

  function sectionHtml(s) {
    var out, items;
    switch (s.type) {
      case "hero":
        out = '<section class="ens-section ens-hero"><h1>' + esc(s.heading) + "</h1>";
        if (s.subheading) out += "<p>" + esc(s.subheading) + "</p>";
        if (s.ctaLabel && safeUrl(s.ctaUrl)) out += '<a class="ens-btn" href="' + attr(s.ctaUrl) + '">' + esc(s.ctaLabel) + "</a>";
        return out + "</section>";
      case "about":
        out = '<section class="ens-section"><h2 class="ens-h">' + esc(s.heading) + '</h2><div class="ens-about">';
        if (safeUrl(s.imageUrl)) out += '<img src="' + attr(s.imageUrl) + '" alt="' + esc(s.heading) + '">';
        return out + "<p>" + esc(s.body) + "</p></div></section>";
      case "bonus":
        items = (s.items || []).map(function (it) {
          var inner = "<b>" + esc(it.title) + "</b>" + (it.desc ? "<span>" + esc(it.desc) + "</span>" : "");
          var href = safeUrl(it.url);
          return href ? '<a class="ens-card" href="' + esc(href) + '">' + inner + "</a>" : '<div class="ens-card">' + inner + "</div>";
        }).join("");
        // id="content" mirrors the hosted page — the default hero CTA links to #content.
        return '<section class="ens-section" id="content"><h2 class="ens-h">' + esc(s.heading) + "</h2>" + items + "</section>";
      case "video":
        out = '<section class="ens-section"><h2 class="ens-h">' + esc(s.heading) + "</h2>";
        if (safeUrl(s.embedUrl)) out += '<iframe class="ens-video" src="' + attr(s.embedUrl) + '" allowfullscreen></iframe>';
        else out += '<p class="ens-note">Video coming soon.</p>';
        return out + "</section>";
      case "links":
        items = (s.items || []).map(function (it) {
          var href = safeUrl(it.url);
          return href ? '<a href="' + esc(href) + '">' + esc(it.label) + "</a>" : "";
        }).join("");
        return '<section class="ens-section ens-linklist"><h2 class="ens-h ens-center">' + esc(s.heading) + "</h2>" + items + "</section>";
      case "merch":
        items = (s.items || []).map(function (it) {
          var img = safeUrl(it.img)
            ? '<img src="' + attr(it.img) + '" alt="' + esc(it.name) + '">'
            : '<div class="ens-merch-ph">' + esc(it.name) + "</div>";
          var buy = s.canBuy && safeUrl(it.buyUrl)
            ? '<a class="ens-btn" href="' + attr(it.buyUrl) + '">Buy now</a>'
            : '<span class="ens-soon">Available soon</span>';
          return '<div class="ens-merch-item">' + img + '<div class="ens-merch-body"><div class="ens-merch-row"><span>' +
            esc(it.name) + "</span><span>" + esc(it.price) + "</span></div>" + buy + "</div></div>";
        }).join("");
        return '<section class="ens-section"><h2 class="ens-h">' + esc(s.heading) + '</h2><div class="ens-grid">' + items + "</div></section>";
      case "newsletter":
        // Deliberately NOT a <form>: fragment parsing drops nested <form> tags when
        // the container sits inside a host-page form, which would silently break this.
        return '<section class="ens-section"><div class="ens-nl"><h2 class="ens-h" style="margin-bottom:0">' + esc(s.heading) + "</h2>" +
          (s.body ? "<p>" + esc(s.body) + "</p>" : "") +
          '<div class="ens-nl-form"><input type="email" required placeholder="you@example.com"><button class="ens-btn" type="button">' +
          esc(s.buttonLabel || "Subscribe") + "</button></div></div></section>";
      case "calendar":
        return '<section class="ens-section ens-center"><h2 class="ens-h">' + esc(s.heading) + "</h2>" +
          (s.body ? '<p class="ens-note">' + esc(s.body) + "</p>" : "") +
          '<a class="ens-btn" target="_blank" rel="noreferrer" href="' + attr(s.url) + '">Open calendar</a></section>';
      case "live":
        out = '<section class="ens-section ens-center"><h2 class="ens-h">' + esc(s.heading) + "</h2>";
        if (s.body) out += '<p class="ens-note">' + esc(s.body) + "</p>";
        if (s.twitchChannel && /^[a-z0-9_]{3,25}$/.test(s.twitchChannel)) {
          out += '<iframe class="ens-video" style="margin-top:1.2rem" allowfullscreen src="https://player.twitch.tv/?channel=' +
            encodeURIComponent(s.twitchChannel) + "&parent=" + encodeURIComponent(location.hostname) + '&muted=true"></iframe>';
        }
        if (s.facebookLiveUrl && /^https:\\/\\/(www\\.)?(facebook\\.com|fb\\.watch)\\//.test(s.facebookLiveUrl)) {
          out += '<iframe class="ens-video" style="margin-top:1.2rem" allowfullscreen src="https://www.facebook.com/plugins/video.php?show_text=false&href=' +
            encodeURIComponent(s.facebookLiveUrl) + '"></iframe>';
        }
        if (s.instagramLiveUser && /^[a-z0-9._]{1,30}$/.test(s.instagramLiveUser)) {
          out += '<p><a class="ens-btn" target="_blank" rel="noreferrer" href="https://instagram.com/' +
            encodeURIComponent(s.instagramLiveUser) + '">Watch my Instagram Live</a></p>';
        }
        return out + "</section>";
      case "contact":
        out = '<section class="ens-section ens-center"><h2 class="ens-h">' + esc(s.heading) + "</h2>";
        if (s.body) out += '<p class="ens-note">' + esc(s.body) + "</p>";
        if (s.email) out += '<a class="ens-btn" href="mailto:' + esc(s.email) + '">' + esc(s.email) + "</a>";
        return out + "</section>";
      default:
        return "";
    }
  }

  function injectCss(accent) {
    if (document.getElementById("ensemble-css")) return;
    if (!/^#[0-9a-fA-F]{3,8}$/.test(accent || "")) accent = "#8b5cf6";
    var style = document.createElement("style");
    style.id = "ensemble-css";
    style.textContent = CSS_TEXT.replace(/__ACCENT__/g, accent);
    document.head.appendChild(style);
  }

  function fill(el, sections, withFooter) {
    el.innerHTML = '<div class="ens' + (dark ? " ens-dark" : "") + '">' +
      sections.map(sectionHtml).join("") +
      (withFooter ? '<p class="ens-powered">Powered by <a href="' + origin + '">Ensemble</a></p>' : "") +
      "</div>";
    bindForms(el);
  }

  function bindForms(root) {
    var boxes = root.querySelectorAll(".ens-nl-form");
    for (var i = 0; i < boxes.length; i++) {
      (function (box) {
        var input = box.querySelector("input");
        var button = box.querySelector("button");
        if (!input || !button) return;
        function submit() {
          if (!input.checkValidity()) { input.reportValidity(); return; }
          fetch(origin + "/api/content/" + encodeURIComponent(token) + "/subscribe", {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ email: input.value }),
          })
            .then(function (r) { return r.json().then(function (j) { return r.ok ? j : Promise.reject(j.error); }); })
            .then(function () { box.outerHTML = '<p class="ens-note" style="margin-top:1.1rem">You\\u2019re in \\u2014 check your inbox soon.</p>'; })
            .catch(function (err) { alert(typeof err === "string" ? err : "Something went wrong \\u2014 try again."); });
        }
        button.addEventListener("click", submit);
        input.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") { ev.preventDefault(); submit(); }
        });
      })(boxes[i]);
    }
  }

  function render(data) {
    injectCss(data.site && data.site.themeColor);
    var targeted = document.querySelectorAll("[data-ensemble-section]");
    if (targeted.length) {
      for (var i = 0; i < targeted.length; i++) {
        var type = targeted[i].getAttribute("data-ensemble-section");
        fill(targeted[i], data.sections.filter(function (s) { return s.type === type; }), false);
      }
      return;
    }
    var main = document.getElementById("ensemble-content") || document.querySelector("[data-ensemble]");
    if (!main) { console.warn('[ensemble] no <div id="ensemble-content"> or [data-ensemble-section] container found'); return; }
    fill(main, data.sections, true);
  }

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  fetch(origin + "/api/content/" + encodeURIComponent(token))
    .then(function (r) {
      if (!r.ok) throw new Error("ensemble content request failed: " + r.status);
      return r.json();
    })
    .then(function (data) { onReady(function () { render(data); }); })
    .catch(function (err) { console.warn("[ensemble]", err); });
})();
`;

export function GET(): Response {
  // Inject the CSS constant inside the IIFE so nothing leaks onto the host page.
  const js = EMBED_JS.replace('"use strict";', '"use strict";\n  var CSS_TEXT = ' + JSON.stringify(CSS) + ";");
  return new Response(js, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
