import type { BetterAuthPlugin } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { GROK_PROVIDERS } from "./providers";

/** Keep broker registrations and existing account subjects stable across 1.7. */
export function grokBrokerOAuth(options: {
  issuer: string;
  clientId: string;
  clientSecret: string;
}): BetterAuthPlugin {
  const issuer = options.issuer.replace(/\/+$/, "");
  const providerIds = new Set(GROK_PROVIDERS.map((p) => p.providerId));
  const plugin = genericOAuth({
    config: GROK_PROVIDERS.map(({ providerId, idp }) => ({
      providerId,
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      authorizationUrl: `${issuer}/api/auth/oauth2/authorize`,
      tokenUrl: `${issuer}/api/auth/oauth2/token`,
      userInfoUrl: `${issuer}/api/auth/oauth2/userinfo`,
      scopes: ["openid", "profile", "email"],
      authorizationUrlParams: { idp, prompt: "login" },
      // The pre-1.7 plugin accepted userinfo.id, falling back to OIDC sub.
      // Explicit endpoints in 1.7 default to id alone; preserve existing keys.
      accountSubject: ({ profile }) => {
        const id = profile.id;
        return id !== undefined && id !== null && id !== "" ? id : (profile.sub ?? "");
      },
    })),
  });
  return {
    ...plugin,
    async init(ctx) {
      const result = await plugin.init(ctx);
      // Core sign-in AND code exchange use callbackPath against the resolved
      // request origin. Avoid hardcoding an origin: previews have dynamic hosts.
      return {
        ...result,
        context: {
          ...result.context,
          socialProviders: result.context.socialProviders.map((provider) =>
            providerIds.has(provider.id)
              ? { ...provider, callbackPath: `/oauth2/callback/${provider.id}` }
              : provider,
          ),
        },
      };
    },
    async onRequest(request, ctx) {
      // Dispatch the already registered broker callback through the fixed core
      // handler, retaining its state, PKCE, origin and session checks.
      const url = new URL(request.url);
      const basePath = new URL(ctx.baseURL).pathname.replace(/\/$/, "");
      for (const providerId of providerIds) {
        if (url.pathname === `${basePath}/oauth2/callback/${providerId}`) {
          url.pathname = `${basePath}/callback/${providerId}`;
          return { request: new Request(url, request) };
        }
      }
    },
  };
}
