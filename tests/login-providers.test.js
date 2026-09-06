const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const LIB = process.env.TEST_LIB;
const sso = require(path.join(LIB, "login-providers.js"));

/**
 * Sign-in with Google / Microsoft / Yahoo.
 *
 * The security of this whole feature is one question: did the provider
 * actually verify that this person owns this address? Everything downstream —
 * find-or-create, session, linking to an account that already has a password —
 * trusts the answer. So the refusals are what these tests are about.
 */

/** Stand in for one provider response, then put the real fetch back. */
async function withFetch(payload, ok, fn) {
  const real = global.fetch;
  global.fetch = async () => ({ ok, json: async () => payload });
  try {
    return await fn();
  } finally {
    global.fetch = real;
  }
}

const google = sso.getLoginProvider("google");
const microsoft = sso.getLoginProvider("microsoft");
const yahoo = sso.getLoginProvider("yahoo");

test("an unverified email is refused, however it is spelled", async () => {
  // The takeover case: a token issued naming someone else's address, with the
  // provider declining to say it verified it.
  for (const claim of [false, "false", undefined, null, 0, "", "yes"]) {
    const r = await withFetch({ email: "victim@example.com", email_verified: claim, name: "V" }, true, () =>
      sso.fetchLoginIdentity(google, "tok")
    );
    assert.equal(r, null, `email_verified=${JSON.stringify(claim)} must not sign anyone in`);
  }

  // Yahoo carries the same claim and gets the same treatment.
  const y = await withFetch({ email: "v@yahoo.com", email_verified: false }, true, () =>
    sso.fetchLoginIdentity(yahoo, "tok")
  );
  assert.equal(y, null);
});

test("a verified email signs in, and a boolean or string claim both count", async () => {
  const a = await withFetch({ email: "real@example.com", email_verified: true, name: "Real Person" }, true, () =>
    sso.fetchLoginIdentity(google, "tok")
  );
  assert.deepEqual(a, { email: "real@example.com", name: "Real Person" });

  const b = await withFetch({ email: "real@example.com", email_verified: "true" }, true, () =>
    sso.fetchLoginIdentity(google, "tok")
  );
  assert.equal(b?.email, "real@example.com");
});

test("a failed provider call signs nobody in", async () => {
  const bad = await withFetch({ error: "nope" }, false, () => sso.fetchLoginIdentity(google, "tok"));
  assert.equal(bad, null, "a non-200 from the provider must fail closed");

  const empty = await withFetch({ email_verified: true }, true, () => sso.fetchLoginIdentity(google, "tok"));
  assert.equal(empty, null, "verified, but no address to sign in as");
});

test("Microsoft falls back to userPrincipalName, which is the address they authenticated with", async () => {
  // `mail` is null on plenty of accounts that sign in perfectly well.
  const r = await withFetch({ mail: null, userPrincipalName: "someone@contoso.com", displayName: "S" }, true, () =>
    sso.fetchLoginIdentity(microsoft, "tok")
  );
  assert.deepEqual(r, { email: "someone@contoso.com", name: "S" });

  // When both are present, the real mailbox wins.
  const both = await withFetch({ mail: "real@contoso.com", userPrincipalName: "upn@contoso.com" }, true, () =>
    sso.fetchLoginIdentity(microsoft, "tok")
  );
  assert.equal(both?.email, "real@contoso.com");
});

test("a Graph guest UPN is not accepted as an email address", () => {
  // Guest accounts carry forms like this. Storing one would create an account
  // whose owner can never receive mail at it, and so can never recover it.
  assert.equal(sso.usableLoginEmail("someone_example.com#EXT#@tenant.onmicrosoft.com"), false);
  assert.equal(sso.usableLoginEmail("has space@example.com"), false);
  assert.equal(sso.usableLoginEmail("two@@example.com"), false);
  assert.equal(sso.usableLoginEmail("no-at-sign"), false);
  assert.equal(sso.usableLoginEmail("no@domain"), false);
  assert.equal(sso.usableLoginEmail(""), false);
  assert.equal(sso.usableLoginEmail("a".repeat(250) + "@example.com"), false, "over 254 chars");

  assert.equal(sso.usableLoginEmail("fine@example.com"), true);
  assert.equal(sso.usableLoginEmail("first.last+tag@sub.example.co.uk"), true);
});

test("the authorize URL carries the state and the exact redirect_uri", () => {
  const uri = "https://ensemble.it.com/api/auth/google/callback";
  const url = new URL(sso.buildLoginAuthorizeUrl(google, "client-123", uri, "st4te"));
  assert.equal(url.searchParams.get("client_id"), "client-123");
  assert.equal(url.searchParams.get("redirect_uri"), uri);
  assert.equal(url.searchParams.get("state"), "st4te");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.ok(url.searchParams.get("scope").includes("email"));
  // A shared browser must not silently re-sign-in the last account.
  assert.equal(url.searchParams.get("prompt"), "select_account");
});

test("only providers with credentials configured are offered", () => {
  const saved = {};
  for (const k of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"]) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  try {
    assert.deepEqual(sso.configuredLoginProviderIds(), [], "nothing configured, nothing offered");

    // Half-configured is not configured — a button that always fails is worse
    // than no button.
    process.env.GOOGLE_CLIENT_ID = "id";
    assert.deepEqual(sso.configuredLoginProviderIds(), [], "id without secret is not usable");

    process.env.GOOGLE_CLIENT_SECRET = "secret";
    assert.deepEqual(sso.configuredLoginProviderIds(), ["google"]);
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test("the redirect_uri pins to APP_URL so both steps send the same string", () => {
  const prev = process.env.APP_URL;
  try {
    process.env.APP_URL = "https://ensemble.it.com";
    // Even arriving on the www host, the registered URI is what gets used.
    assert.equal(
      sso.loginRedirectUri("https://www.ensemble.it.com", "google"),
      "https://ensemble.it.com/api/auth/google/callback"
    );
    process.env.APP_URL = "https://ensemble.it.com/";
    assert.equal(
      sso.loginRedirectUri("http://localhost:3000", "microsoft"),
      "https://ensemble.it.com/api/auth/microsoft/callback",
      "a trailing slash must not produce a double slash"
    );
    delete process.env.APP_URL;
    assert.equal(
      sso.loginRedirectUri("http://localhost:3000", "yahoo"),
      "http://localhost:3000/api/auth/yahoo/callback"
    );
  } finally {
    if (prev === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = prev;
  }
});
