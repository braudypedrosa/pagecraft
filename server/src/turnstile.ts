export interface HumanChallenge {
  verify(input: { token: string; ip?: string; action: 'signup' | 'login' | 'forgot' }): Promise<boolean>;
}

/** Supabase Auth consumes and validates the single-use Turnstile token. */
export class SupabaseHumanChallenge implements HumanChallenge {
  async verify(input: { token: string }) { return input.token.length > 0; }
}

/** Explicit local/test configuration. Production never selects this implementation. */
export class TestHumanChallenge implements HumanChallenge {
  async verify(input: { token: string }) { return input.token === 'pagecraft-test-human'; }
}
