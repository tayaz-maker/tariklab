import { it } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { bearer } from "better-auth/plugins";
import { handleAuthPopup, type PopupAuthAPI } from "./popup-handler.server.ts";
import { grokBrokerOAuth } from "./broker-oauth.server.ts";

const issuer = "https://broker.example";
const sessionCookie = "__Host-grok-auth.session_token";

function fixture(origin: string, dynamic = false) {
  const db: Record<string, Record<string, unknown>[]> = {
    user: [],
    account: [],
    session: [],
    verification: [],
  };
  const auth = betterAuth({
    baseURL: dynamic ? { allowedHosts: ["*.grok-sandbox.com"], protocol: "https" } : origin,
    secret: "protocol-test-secret-with-at-least-32-characters",
    database: memoryAdapter(db),
    trustedOrigins: [origin],
    account: { encryptOAuthTokens: true },
    advanced: {
      useSecureCookies: false,
      defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/" },
      cookies: { session_token: { name: sessionCookie } },
    },
    plugins: [
      grokBrokerOAuth({ issuer, clientId: "registered-app", clientSecret: "test-secret" }),
      bearer(),
    ],
    logger: { disabled: true },
  });
  const request = (path: string, init?: RequestInit) =>
    auth.handler(new Request(`${origin}${path}`, init));
  const begin = (provider = "grok-google", callbackURL = "/account") =>
    request("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({
        provider,
        callbackURL,
        errorCallbackURL: "/login?failed=1",
        disableRedirect: true,
      }),
    });
  return { auth, db, request, begin };
}

function cookies(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}

for (const [origin, dynamic] of [
  ["https://www.tariklab.com", false],
  ["https://tariklab.com", false],
  ["https://protocol-test.grok-sandbox.com", true],
] as const) {
  for (const [providerId, idp] of [
    ["grok-google", "google"],
    ["grok-x", "twitter"],
  ]) {
    it(`completes ${providerId} broker code flow at ${origin} with stable callback/account, cookie and bearer sessions`, async (t) => {
      const { db, request, begin } = fixture(origin, dynamic);
      const response = await begin(providerId);
      assert.equal(response.status, 200);
      const authorization = new URL((await response.json()).url);
      const redirectURI = `${origin}/api/auth/oauth2/callback/${providerId}`;
      assert.equal(authorization.origin, issuer);
      assert.equal(authorization.pathname, "/api/auth/oauth2/authorize");
      assert.equal(authorization.searchParams.get("client_id"), "registered-app");
      assert.equal(authorization.searchParams.get("redirect_uri"), redirectURI);
      assert.equal(authorization.searchParams.get("response_type"), "code");
      assert.equal(authorization.searchParams.get("idp"), idp);
      assert.equal(authorization.searchParams.get("prompt"), "login");
      assert.deepEqual(
        new Set(authorization.searchParams.get("scope")?.split(" ")),
        new Set(["openid", "profile", "email"]),
      );
      assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
      const state = authorization.searchParams.get("state");
      assert.ok(state);
      let exchanges = 0;
      let profileReads = 0;
      t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === `${issuer}/api/auth/oauth2/token`) {
          exchanges += 1;
          const params = new URLSearchParams(String(init?.body));
          assert.equal(params.get("code"), "single-use-code");
          assert.equal(params.get("redirect_uri"), redirectURI);
          assert.equal(params.get("grant_type"), "authorization_code");
          const verifier = params.get("code_verifier");
          assert.ok(verifier);
          assert.equal(
            createHash("sha256").update(verifier).digest("base64url"),
            authorization.searchParams.get("code_challenge"),
          );
          return Response.json({
            access_token: "broker-access-token",
            token_type: "Bearer",
            expires_in: 3600,
          });
        }
        assert.equal(url, `${issuer}/api/auth/oauth2/userinfo`);
        profileReads += 1;
        assert.equal(new Headers(init?.headers).get("authorization"), "Bearer broker-access-token");
        // OIDC userinfo commonly has sub without id. Preserve the old key.
        return Response.json({
          sub: "existing-broker-subject",
          email: "viewer@example.com",
          email_verified: true,
          name: "Viewer",
        });
      });
      const callback = `/api/auth/oauth2/callback/${providerId}?code=single-use-code&state=${encodeURIComponent(state)}`;
      const complete = await request(callback, { headers: { cookie: cookies(response) } });
      assert.equal(complete.status, 302);
      assert.equal(new URL(complete.headers.get("location")!, origin).href, `${origin}/account`);
      assert.equal(exchanges, 1);
      assert.equal(profileReads, 1);
      assert.equal(db.account.length, 1);
      assert.equal(db.account[0].accountId, "existing-broker-subject");
      assert.equal(db.account[0].providerId, providerId);
      assert.notEqual(db.account[0].accessToken, "broker-access-token");
      const sessionSetCookie = complete.headers
        .getSetCookie()
        .find((value) => value.startsWith(`${sessionCookie}=`));
      assert.ok(sessionSetCookie);
      assert.match(sessionSetCookie, /; Secure/i);
      assert.match(sessionSetCookie, /; HttpOnly/i);
      assert.match(sessionSetCookie, /; Path=\//i);
      assert.match(sessionSetCookie, /; SameSite=Lax/i);
      assert.doesNotMatch(sessionSetCookie, /; Domain=/i);
      const session = await request("/api/auth/get-session", {
        headers: { cookie: cookies(complete) },
      });
      assert.equal(session.status, 200);
      assert.equal((await session.json()).user.id, db.user[0].id);
      const popupBearer = decodeURIComponent(
        sessionSetCookie.split(";")[0].slice(sessionCookie.length + 1),
      );
      const bearerSession = await request("/api/auth/get-session", {
        headers: { authorization: `Bearer ${popupBearer}` },
      });
      assert.equal((await bearerSession.json()).user.id, db.user[0].id);
      const replay = await request(callback, { headers: { cookie: cookies(response) } });
      assert.equal(replay.status, 302);
      assert.match(replay.headers.get("location") ?? "", /error=/);
      assert.equal(exchanges, 1, "consumed state cannot exchange a code again");
      const bearerToken = db.session[0].token;
      const signOut = await request("/api/auth/sign-out", {
        method: "POST",
        headers: { origin, cookie: cookies(complete) },
      });
      assert.equal(signOut.status, 200);
      assert.equal(db.session.length, 0);
      assert.equal(
        await (
          await request("/api/auth/get-session", {
            headers: { authorization: `Bearer ${bearerToken}` },
          })
        ).json(),
        null,
      );
    });
  }
}

it("rejects forged/missing state, unknown providers, cross-origin initiations and untrusted returns without contacting broker", async (t) => {
  const { request, begin, db } = fixture("https://www.tariklab.com");
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    throw new Error("unexpected broker request");
  });
  for (const query of ["code=forged", "code=forged&state=forged-state"]) {
    const result = await request(`/api/auth/oauth2/callback/grok-google?${query}`);
    assert.equal(result.status, 302);
    assert.match(result.headers.get("location") ?? "", /error=/);
  }
  assert.equal((await begin("unknown-provider")).status, 404);
  assert.equal((await begin("grok-google", "https://attacker.example/steal")).status, 403);
  const csrf = await request("/api/auth/sign-in/social", {
    method: "POST",
    headers: {
      origin: "https://attacker.example",
      cookie: "existing=credential",
      "content-type": "application/json",
    },
    body: JSON.stringify({ provider: "grok-google", callbackURL: "/" }),
  });
  assert.equal(csrf.status, 403);
  assert.equal(calls, 0);
  assert.equal(db.session.length, 0);
});

it("preview popup preserves OAuth cookies, dynamic legacy redirect URI, completion origin and token handoff", async () => {
  const origin = "https://popup-test.grok-sandbox.com";
  const { auth } = fixture(origin, true);
  const api: PopupAuthAPI = {
    sessionTokenCookie: sessionCookie,
    signInSocial: (options) => auth.api.signInSocial(options),
  };
  const response = await handleAuthPopup(
    new Request(`${origin}/auth/popup?providerId=grok-google`, {
      headers: { host: new URL(origin).host },
    }),
    api,
  );
  assert.equal(response.status, 302);
  const authorization = new URL(response.headers.get("location")!);
  assert.equal(
    authorization.searchParams.get("redirect_uri"),
    `${origin}/api/auth/oauth2/callback/grok-google`,
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(response.headers.getSetCookie().length > 0);
  const done = await handleAuthPopup(
    new Request(`${origin}/auth/popup?done=1`, {
      headers: { cookie: `${sessionCookie}=signed%2Bsession%3Dvalue` },
    }),
    api,
  );
  assert.equal(done.status, 200);
  assert.equal(done.headers.get("cache-control"), "no-store");
  const html = await done.text();
  assert.match(html, /"token":"signed\+session=value"/);
  assert.match(html, /postMessage\(msg, window.location.origin\)/);
  assert.match(html, /window.close\(\)/);
  const error = await handleAuthPopup(
    new Request(`${origin}/auth/popup?done=1&error=%3C%2Fscript%3E`, {
      headers: { cookie: `${sessionCookie}=must-not-leak` },
    }),
    api,
  );
  const errorHtml = await error.text();
  assert.match(errorHtml, /"token":null/);
  assert.doesNotMatch(errorHtml, /must-not-leak/);
  assert.match(errorHtml, /\\u003c\/script>/);
});

it("retains a pre-1.7 signed cookie and relinks the original account using id before sub", async (t) => {
  const origin = "https://www.tariklab.com";
  const { db, request, begin } = fixture(origin);
  const now = new Date();
  db.user.push({
    id: "original-local-user",
    email: "existing@example.com",
    emailVerified: true,
    name: "Existing",
    createdAt: now,
    updatedAt: now,
  });
  db.account.push({
    id: "original-account",
    userId: "original-local-user",
    providerId: "grok-google",
    accountId: "broker-id",
    createdAt: now,
    updatedAt: now,
  });
  const token = "synthetic-1.6-session-token";
  db.session.push({
    id: "original-session",
    userId: "original-local-user",
    token,
    expiresAt: new Date(Date.now() + 3600000),
    createdAt: now,
    updatedAt: now,
  });
  // Better Auth 1.6.30 / better-call 1.4.0 uses HMAC SHA-256, padded
  // base64 and URI encoding. Cross-checked against the installed old writer.
  const signature = createHmac("sha256", "protocol-test-secret-with-at-least-32-characters")
    .update(token)
    .digest("base64");
  const oldCookie = `${sessionCookie}=${encodeURIComponent(`${token}.${signature}`)}`;
  const oldSession = await request("/api/auth/get-session", { headers: { cookie: oldCookie } });
  assert.equal((await oldSession.json()).user.id, "original-local-user");
  const initial = await begin();
  const state = new URL((await initial.json()).url).searchParams.get("state")!;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    if (String(input).endsWith("/token"))
      return Response.json({ access_token: "refreshed-broker-token", token_type: "Bearer" });
    assert.equal(String(input), `${issuer}/api/auth/oauth2/userinfo`);
    return Response.json({
      id: "broker-id",
      sub: "different-sub",
      email: "existing@example.com",
      email_verified: true,
      name: "Existing",
    });
  });
  const completed = await request(
    `/api/auth/oauth2/callback/grok-google?code=relogin&state=${encodeURIComponent(state)}`,
    {
      headers: { cookie: cookies(initial) },
    },
  );
  assert.equal(completed.status, 302);
  assert.equal(completed.headers.get("location"), "/account");
  assert.equal(db.user.length, 1);
  assert.equal(db.user[0].id, "original-local-user");
  assert.equal(db.account.length, 1);
  assert.equal(db.account[0].id, "original-account");
  assert.equal(db.account[0].accountId, "broker-id");
  const relogged = await request("/api/auth/get-session", {
    headers: { cookie: cookies(completed) },
  });
  assert.equal((await relogged.json()).user.id, "original-local-user");
});
