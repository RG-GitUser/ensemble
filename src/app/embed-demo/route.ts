import { getSiteBySlug } from "@/lib/db";

/**
 * A deliberately plain, framework-free HTML page pretending to be a creator's
 * pre-existing website, with the Ensemble embed snippet pasted in — exactly
 * what a visitor's browser would do on a real external site.
 */
export function GET(): Response {
  const site = getSiteBySlug("demo");
  if (!site) return new Response("Demo site missing", { status: 404 });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nova Rae — Official Site (mock)</title>
<style>
  body { margin: 0; font-family: Georgia, "Times New Roman", serif; background: #faf7f2; color: #2b2620; }
  .oldnav { display: flex; gap: 1.5rem; align-items: baseline; padding: 1.1rem 2rem; border-bottom: 3px double #c9bfae; background: #fffdf9; }
  .oldnav b { font-size: 1.3rem; margin-right: auto; }
  .oldnav a { color: #6b5d4a; text-decoration: none; font-size: .95rem; }
  .banner { background: #14b8a6; color: #fff; text-align: center; padding: .6rem 1rem; font-family: system-ui, sans-serif; font-size: .85rem; }
  .banner a { color: #fff; }
  main { max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }
  .legacy { border: 1px solid #e2d9c8; background: #fffdf9; padding: 1.2rem 1.4rem; font-size: .95rem; color: #6b5d4a; }
  .divider { margin: 2.5rem 0; border: 0; border-top: 3px double #c9bfae; }
  .embed-note { font-family: system-ui, sans-serif; font-size: .8rem; letter-spacing: .08em; text-transform: uppercase; color: #a0937f; margin-bottom: 1.5rem; }
  footer { text-align: center; color: #a0937f; font-size: .85rem; padding: 2rem; border-top: 3px double #c9bfae; background: #fffdf9; }
</style>
</head>
<body>
<div class="banner">
  This is a mock of a creator's <b>existing website</b> — everything below the double line is rendered live by the
  Ensemble embed snippet. Edit the demo in a dashboard and reload.
</div>
<nav class="oldnav"><b>Nova Rae</b><a href="#">Music</a><a href="#">Tour</a><a href="#">Press</a><a href="#">Contact</a></nav>
<main>
  <div class="legacy">
    <p><b>novarae.com</b> — hand-built in 2019, still standing. The band keeps the domain and this old page…</p>
    <p style="margin-bottom:0">…and everything below is now managed from the Ensemble dashboard. No rebuild, one pasted snippet.</p>
  </div>
  <hr class="divider">
  <p class="embed-note">▼ Ensemble embed starts here</p>

  <script src="/embed.js" data-site="${site.embedToken}" async></script>
  <div id="ensemble-content"></div>

</main>
<footer>© Nova Rae. Site by a friend of the band, 2019.</footer>
</body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
