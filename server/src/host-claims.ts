import { createHmac } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';

export interface HostClaimChallenge {
  type: 'dns_txt';
  name: string;
  value: string;
}

export interface HostClaims {
  challenge(host: string, actorId: string): HostClaimChallenge;
  verify(host: string, actorId: string): Promise<boolean>;
}

export type TxtLookup = (name: string) => Promise<readonly (readonly string[])[]>;

/** DNS proof is scoped to both hostname and signed-in profile. Pointing a domain at Pagecraft is
 * routing, not ownership. Only the actor-specific TXT value authorizes a claim. */
export function dnsHostClaims(secret: string, lookup: TxtLookup = resolveTxt): HostClaims {
  if (secret.length < 32) throw new Error('host claim secret must be at least 32 characters');
  const challenge = (host: string, actorId: string): HostClaimChallenge => ({
    type: 'dns_txt',
    name: `_pagecraft.${host}`,
    value: 'pagecraft-verification=' + createHmac('sha256', secret)
      .update(`${actorId}\0${host}`)
      .digest('base64url'),
  });
  return {
    challenge,
    async verify(host, actorId) {
      const expected = challenge(host, actorId);
      try {
        return (await lookup(expected.name)).some(parts => parts.join('') === expected.value);
      } catch {
        return false;
      }
    },
  };
}
