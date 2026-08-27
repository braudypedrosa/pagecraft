import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { normalEmail } from './auth.ts';

export interface VerifiedIdentity {
  authUserId: string;
  email: string;
  name: string;
}

export interface AccountAuth {
  identity(c: Context): Promise<VerifiedIdentity | null>;
  signUp(c: Context, input: { email: string; password: string; name: string; redirectTo: string; captchaToken: string }): Promise<'confirmation_required' | 'exists'>;
  signIn(c: Context, input: { email: string; password: string; captchaToken: string }): Promise<VerifiedIdentity | null>;
  confirm(c: Context, input: { code?: string; tokenHash?: string; type?: string }): Promise<VerifiedIdentity | null>;
  forgot(c: Context, input: { email: string; redirectTo: string; captchaToken: string }): Promise<void>;
  reset(c: Context, password: string): Promise<boolean>;
  signOut(c: Context): Promise<void>;
}

export interface SupabaseAccountAuthOptions {
  url: string;
  publishableKey: string;
  secureCookies: boolean;
  cookieName?: string;
}

const verified = (user: User | null): VerifiedIdentity | null => {
  if (!user?.id || !user.email || !user.email_confirmed_at) return null;
  const name = typeof user.user_metadata?.name === 'string' ? user.user_metadata.name.trim().slice(0, 120) : '';
  return { authUserId: user.id, email: normalEmail(user.email), name };
};

export class SupabaseAccountAuth implements AccountAuth {
  private options: SupabaseAccountAuthOptions;
  constructor(options: SupabaseAccountAuthOptions) { this.options = options; }

  private client(c: Context): SupabaseClient {
    const incoming = getCookie(c);
    return createServerClient(this.options.url, this.options.publishableKey, {
      cookieOptions: {
        name: this.options.cookieName || 'pc_auth', path: '/', sameSite: 'lax',
        httpOnly: true, secure: this.options.secureCookies
      },
      cookies: {
        getAll: () => Object.entries(incoming).map(([name, value]) => ({ name, value })),
        setAll: cookies => {
          for (const item of cookies) {
            const supplied = item.options as CookieOptionsWithName;
            setCookie(c, item.name, item.value, {
              ...supplied,
              path: '/', sameSite: 'Lax', httpOnly: true,
              secure: this.options.secureCookies
            });
          }
        }
      },
      auth: { flowType: 'pkce', autoRefreshToken: false, detectSessionInUrl: false, persistSession: true }
    });
  }

  async identity(c: Context) {
    const client = this.client(c);
    const { data: claims, error } = await client.auth.getClaims();
    if (error || !claims?.claims?.sub) return null;
    /* getClaims establishes identity. getUser is used only to read the verified address and
       display name; metadata never participates in Pagecraft authorization. */
    const { data } = await client.auth.getUser();
    const identity = verified(data.user);
    return identity?.authUserId === claims.claims.sub ? identity : null;
  }

  async signUp(c: Context, input: { email: string; password: string; name: string; redirectTo: string; captchaToken: string }) {
    const { data, error } = await this.client(c).auth.signUp({
      email: input.email,
      password: input.password,
      options: { emailRedirectTo: input.redirectTo, data: { name: input.name }, captchaToken: input.captchaToken }
    });
    /* Supabase deliberately returns an obfuscated user for duplicate confirmed accounts.
       Keep Pagecraft's response non-enumerating in both cases. */
    if (error || !data.user || data.user.identities?.length === 0) return 'exists' as const;
    return 'confirmation_required' as const;
  }

  async signIn(c: Context, input: { email: string; password: string; captchaToken: string }) {
    const { data, error } = await this.client(c).auth.signInWithPassword({
      email: input.email, password: input.password, options: { captchaToken: input.captchaToken }
    });
    if (error) return null;
    return verified(data.user);
  }

  async confirm(c: Context, input: { code?: string; tokenHash?: string; type?: string }) {
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
    await this.client(c).auth.resetPasswordForEmail(input.email, {
      redirectTo: input.redirectTo, captchaToken: input.captchaToken
    });
  }

  async reset(c: Context, password: string) {
    const { error } = await this.client(c).auth.updateUser({ password });
    return !error;
  }

  async signOut(c: Context) {
    await this.client(c).auth.signOut({ scope: 'local' });
  }
}
