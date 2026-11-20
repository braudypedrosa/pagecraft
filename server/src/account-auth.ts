import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { normalEmail } from './auth.ts';

export interface VerifiedIdentity {
  authUserId: string;
  email: string;
  name: string;
  providers?: string[];
  createdAt?: string;
  /** When Auth last issued this person a session; account deletion asks for a recent one. */
  lastSignInAt?: string;
}

export interface AccountAuth {
  identity(c: Context): Promise<VerifiedIdentity | null>;
  oauth(c: Context, input: { provider: 'google'; redirectTo: string; link?: boolean }): Promise<string | null>;
  /* 'challenge' means Auth refused the human-challenge token, so the attempt proved nothing
     about the address or password and must not count against either. */
  signUp(c: Context, input: { email: string; password: string; name: string; redirectTo: string; captchaToken: string }): Promise<'confirmation_required' | 'exists' | 'challenge'>;
  signIn(c: Context, input: { email: string; password: string; captchaToken: string }): Promise<VerifiedIdentity | 'challenge' | null>;
  confirm(c: Context, input: { code?: string; tokenHash?: string; type?: string; linkUserId?: string; flowId?: string }): Promise<VerifiedIdentity | null>;
  forgot(c: Context, input: { email: string; redirectTo: string; captchaToken: string }): Promise<void | 'challenge'>;
  reset(c: Context, password: string): Promise<boolean>;
  updateEmail(c: Context, input: { email: string; redirectTo: string }): Promise<boolean>;
  updatePassword(c: Context, input: { password: string; currentPassword?: string }): Promise<boolean>;
  signOut(c: Context): Promise<void>;
  /** Checks the password without touching the browser session (account deletion). */
  verifyPassword?(c: Context, input: { email: string; password: string; captchaToken: string }): Promise<boolean | 'challenge'>;
  /** Ends every session for this person, on all devices. */
  signOutEverywhere?(c: Context): Promise<void>;
}

export interface SupabaseAccountAuthOptions {
  url: string;
  publishableKey: string;
  secureCookies: boolean;
  cookieName?: string;
  /** How long a session's account details are trusted before Auth is asked again. */
  identityTtlMs?: number;
  now?: () => number;
}

/* Every signed-in request used to ask Supabase Auth who was calling: 0.3–0.7 s across the
   Pacific, before the route did anything. The access token is an ES256 JWT, so its signature,
   expiry and subject are checked here against the project's published key instead (cached by
   auth-js for ten minutes). The account details the token does not carry — confirmed email,
   providers, sign-in times — come from Auth once per session per TTL. A session ended
   elsewhere (sign-out everywhere, a deleted account) therefore stops working here within the
   TTL rather than at once; actions on this server forget the session immediately. */
const IDENTITY_TTL_MS = 5 * 60 * 1000;
const IDENTITY_CACHE_MAX = 2000;

const verified = (user: User | null): VerifiedIdentity | null => {
  if (!user?.id || !user.email || !user.email_confirmed_at) return null;
  const metadataName = typeof user.user_metadata?.name === 'string' ? user.user_metadata.name
    : typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';
  const name = metadataName.trim().slice(0, 120);
  const providers = [...new Set([
    ...(Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : []),
    ...(user.identities || []).map(identity => identity.provider)
  ].filter(provider => typeof provider === 'string'))] as string[];
  return {
    authUserId: user.id, email: normalEmail(user.email), name,
    providers, createdAt: user.created_at,
    ...(user.last_sign_in_at ? { lastSignInAt: user.last_sign_in_at } : {}),
  };
};

export class SupabaseAccountAuth implements AccountAuth {
  private options: SupabaseAccountAuthOptions;
  private identities = new Map<string, { until: number; identity: VerifiedIdentity }>();
  constructor(options: SupabaseAccountAuthOptions) { this.options = options; }

  private now() { return (this.options.now || Date.now)(); }

  /** Drop every cached session of this person, so the next request asks Auth again. */
  private forget(authUserId: string | undefined) {
    if (!authUserId) return;
    for (const key of this.identities.keys()) if (key.startsWith(authUserId + '\n')) this.identities.delete(key);
  }

  private async sessionUser(c: Context): Promise<string | undefined> {
    const { data } = await this.client(c).auth.getClaims().catch(() => ({ data: null }));
    return typeof data?.claims?.sub === 'string' ? data.claims.sub : undefined;
  }

  private client(c: Context, write: (apply: () => void) => void = apply => apply()): SupabaseClient {
    const incoming = getCookie(c);
    return createServerClient(this.options.url, this.options.publishableKey, {
      cookieOptions: {
        name: this.options.cookieName || 'pc_auth', path: '/', sameSite: 'lax',
        httpOnly: true, secure: this.options.secureCookies
      },
      cookies: {
        getAll: () => Object.entries(incoming).map(([name, value]) => ({ name, value })),
        setAll: cookies => write(() => {
          for (const item of cookies) {
            const supplied = item.options as CookieOptionsWithName;
            setCookie(c, item.name, item.value, {
              ...supplied,
              path: '/', sameSite: 'Lax', httpOnly: true,
              secure: this.options.secureCookies
            });
          }
        })
      },
      auth: { flowType: 'pkce', autoRefreshToken: false, detectSessionInUrl: false, persistSession: true }
    });
  }

  async identity(c: Context) {
    const client = this.client(c);
    // Refreshes an expired session (writing the new cookies), then verifies the token locally.
    const { data: checked, error: invalid } = await client.auth.getClaims();
    const claims = checked?.claims;
    if (invalid || typeof claims?.sub !== 'string' || typeof claims.session_id !== 'string') return null;
    const key = `${claims.sub}\n${claims.session_id}`;
    const hit = this.identities.get(key);
    if (hit && hit.until > this.now()) return { ...hit.identity };
    this.identities.delete(key);
    // Once per session per TTL: Auth confirms the session is live and supplies the account.
    const { data, error } = await client.auth.getUser();
    const identity = error ? null : verified(data.user);
    if (!identity || identity.authUserId !== claims.sub) return null;
    if (this.identities.size >= IDENTITY_CACHE_MAX) this.identities.delete(this.identities.keys().next().value!);
    this.identities.set(key, { until: this.now() + (this.options.identityTtlMs ?? IDENTITY_TTL_MS), identity });
    return { ...identity };
  }

  async signUp(c: Context, input: { email: string; password: string; name: string; redirectTo: string; captchaToken: string }) {
    const { data, error } = await this.client(c).auth.signUp({
      email: input.email,
      password: input.password,
      options: { emailRedirectTo: input.redirectTo, data: { name: input.name }, captchaToken: input.captchaToken }
    });
    if (error?.code === 'captcha_failed') return 'challenge' as const;
    /* Supabase deliberately returns an obfuscated user for duplicate confirmed accounts.
       Keep Pagecraft's response non-enumerating in both cases. */
    if (error || !data.user || data.user.identities?.length === 0) return 'exists' as const;
    return 'confirmation_required' as const;
  }

  async oauth(c: Context, input: { provider: 'google'; redirectTo: string; link?: boolean }) {
    if (input.link) {
      const { data, error } = await this.client(c).auth.linkIdentity({
        provider: input.provider,
        options: { redirectTo: input.redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } }
      });
      return error ? null : data.url;
    }
    const { data, error } = await this.client(c).auth.signInWithOAuth({
      provider: input.provider,
      options: { redirectTo: input.redirectTo }
    });
    return error ? null : data.url;
  }

  async signIn(c: Context, input: { email: string; password: string; captchaToken: string }) {
    const { data, error } = await this.client(c).auth.signInWithPassword({
      email: input.email, password: input.password, options: { captchaToken: input.captchaToken }
    });
    if (error) return error.code === 'captcha_failed' ? 'challenge' as const : null;
    return verified(data.user);
  }

  async confirm(c: Context, input: { code?: string; tokenHash?: string; type?: string; linkUserId?: string; flowId?: string }) {
    if (input.linkUserId) {
      if (!input.code) return null;
      // A link must keep the current Pagecraft account. Commit the PKCE session cookies
      // only after Auth confirms the Google identity belongs to this same verified user.
      const writes: (() => void)[] = [];
      const client = this.client(c, apply => writes.push(apply));
      const { data, error } = await client.auth.exchangeCodeForSession(input.code, { flowId: input.flowId });
      const identity = error ? null : verified(data.user);
      if (identity?.authUserId !== input.linkUserId || !data.user?.identities?.some(item => item.provider === 'google')) return null;
      for (const apply of writes) apply();
      this.forget(identity.authUserId);
      return identity;
    }
    const client = this.client(c);
    if (input.code) {
      const { data, error } = await client.auth.exchangeCodeForSession(input.code);
      return error ? null : verified(data.user);
    }
    if (!input.tokenHash) return null;
    const allowed = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const;
    const type = allowed.find(candidate => candidate === input.type) || 'email';
    const { data, error } = await client.auth.verifyOtp({
      token_hash: input.tokenHash,
      type
    });
    return error ? null : verified(data.user);
  }

  async forgot(c: Context, input: { email: string; redirectTo: string; captchaToken: string }) {
    const { error } = await this.client(c).auth.resetPasswordForEmail(input.email, {
      redirectTo: input.redirectTo, captchaToken: input.captchaToken
    });
    if (error?.code === 'captcha_failed') return 'challenge' as const;
  }

  async reset(c: Context, password: string) {
    const { data, error } = await this.client(c).auth.updateUser({ password });
    if (!error) this.forget(data?.user?.id);
    return !error;
  }

  async updateEmail(c: Context, input: { email: string; redirectTo: string }) {
    const { data, error } = await this.client(c).auth.updateUser(
      { email: input.email }, { emailRedirectTo: input.redirectTo }
    );
    if (!error) this.forget(data?.user?.id);
    return !error;
  }

  async updatePassword(c: Context, input: { password: string; currentPassword?: string }) {
    const { data, error } = await this.client(c).auth.updateUser({
      password: input.password,
      ...(input.currentPassword ? { current_password: input.currentPassword } : {})
    });
    if (!error) this.forget(data?.user?.id);
    return !error;
  }

  async signOut(c: Context) {
    this.forget(await this.sessionUser(c));
    await this.client(c).auth.signOut({ scope: 'local' });
  }

  /* A throwaway client with no cookies or storage: the browser's session is untouched, and the
     extra session the check creates is signed out again immediately. */
  async verifyPassword(_c: Context, input: { email: string; password: string; captchaToken: string }) {
    const probe = createClient(this.options.url, this.options.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await probe.auth.signInWithPassword({
      email: input.email, password: input.password, options: { captchaToken: input.captchaToken },
    });
    if (error) return error.code === 'captcha_failed' ? 'challenge' as const : false;
    if (data.session) await probe.auth.signOut({ scope: 'local' }).catch(() => undefined);
    return normalEmail(data.user?.email || '') === normalEmail(input.email);
  }

  async signOutEverywhere(c: Context) {
    this.forget(await this.sessionUser(c));
    await this.client(c).auth.signOut({ scope: 'global' });
  }
}
