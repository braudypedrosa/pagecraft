import { test } from "vitest";
import a from "node:assert/strict";
import { isCloudflareAddress, requestSourceFrom } from "../src/request-source.ts";

test("the rightmost X-Forwarded-For entry is the source", () => {
  a.equal(requestSourceFrom({ forwardedFor: "198.51.100.1" }), "198.51.100.1");
  a.equal(requestSourceFrom({ forwardedFor: "1.2.3.4, 198.51.100.1" }), "198.51.100.1");
  a.equal(requestSourceFrom({ forwardedFor: " 1.2.3.4 ,  198.51.100.1 , " }), "198.51.100.1");
});

test("without a header, the socket peer, then unknown", () => {
  a.equal(requestSourceFrom({ socketAddress: "::ffff:192.0.2.1" }), "192.0.2.1");
  a.equal(requestSourceFrom({ forwardedFor: "", socketAddress: "192.0.2.1" }), "192.0.2.1");
  a.equal(requestSourceFrom({}), "unknown");
});

test("CF-Connecting-IP is believed only when trusted and the peer is a Cloudflare edge", () => {
  const viaEdge = { forwardedFor: "1.2.3.4, 198.51.100.7, 172.70.1.1", cfConnectingIp: "198.51.100.7" };
  a.equal(requestSourceFrom(viaEdge, true), "198.51.100.7");
  a.equal(requestSourceFrom(viaEdge, false), "172.70.1.1");
  a.equal(requestSourceFrom({ forwardedFor: "203.0.113.9", cfConnectingIp: "198.51.100.7" }, true), "203.0.113.9");
  a.equal(requestSourceFrom({ forwardedFor: "2606:4700::1", cfConnectingIp: "2001:db8::5" }, true), "2001:db8::5");
  a.equal(requestSourceFrom({ forwardedFor: "172.70.1.1", cfConnectingIp: "not an address" }, true), "172.70.1.1");
});

test("Cloudflare ranges", () => {
  for (const ip of ["173.245.48.1", "162.159.255.255", "104.23.0.1", "::ffff:172.64.0.1", "2a06:98c7::1"]) {
    a.ok(isCloudflareAddress(ip), ip);
  }
  for (const ip of ["203.0.113.9", "10.0.0.1", "2001:db8::1", "", "garbage"]) {
    a.ok(!isCloudflareAddress(ip), ip);
  }
});
