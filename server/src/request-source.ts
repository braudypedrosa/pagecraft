import { BlockList, isIP } from "node:net";

/* The address every per-source rate limit keys on.

   Production is Client -> Cloudflare -> LiteSpeed -> Node, and Node hears LiteSpeed over a Unix
   socket, so the socket has no peer address. Everything has to come from headers, and only the
   parts a trusted hop wrote may be believed:

   - Cloudflare *appends* the client to any `X-Forwarded-For` the client sent. The leftmost entry
     is therefore whatever the caller typed, never the source. Keying on it let one caller rotate
     through fresh rate-limit buckets by sending a new made-up address on every request.
   - LiteSpeed either appends its own peer or replaces the header with it. Both leave the address
     LiteSpeed actually saw as the rightmost entry, and a caller cannot put anything after it.
   - The origin's address is public, so a caller can skip Cloudflare and talk to LiteSpeed
     directly with any `CF-Connecting-IP` it likes. That header is only believed when the
     rightmost hop really is a Cloudflare edge.

   So: the rightmost `X-Forwarded-For` entry is the peer. When Cloudflare is trusted and that peer
   is one of its edges, `CF-Connecting-IP` is the client; otherwise the peer is. */

/* https://www.cloudflare.com/ips/ — published, and changes rarely. */
const CLOUDFLARE_RANGES = [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
  "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
  "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
  "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32",
  "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
];

const cloudflare = new BlockList();
for (const range of CLOUDFLARE_RANGES) {
  const [network, prefix] = range.split("/");
  cloudflare.addSubnet(network, Number(prefix), isIP(network) === 6 ? "ipv6" : "ipv4");
}

/* `::ffff:1.2.3.4` is the IPv4 address as an IPv6 socket reports it. */
function normalize(address: string): string {
  const value = address.trim();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(value);
  return mapped ? mapped[1] : value;
}

export function isCloudflareAddress(address: string): boolean {
  const value = normalize(address);
  const family = isIP(value);
  if (!family) return false;
  return cloudflare.check(value, family === 6 ? "ipv6" : "ipv4");
}

export type SourceHeaders = {
  forwardedFor?: string | null;
  cfConnectingIp?: string | null;
  socketAddress?: string | null;
};

export function requestSourceFrom(
  headers: SourceHeaders,
  trustCloudflare = false,
): string {
  const hops = (headers.forwardedFor || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const peer = normalize(hops[hops.length - 1] || headers.socketAddress || "");
  const client = normalize(headers.cfConnectingIp || "");
  if (trustCloudflare && client && isIP(client) && isCloudflareAddress(peer)) return client;
  return peer || "unknown";
}
