import { createHash } from 'node:crypto';

/**
 * Versioned, content-addressed binary transport for the private Supabase gateway.
 *
 * The gateway is deliberately a JSON control plane. A release artifact can legally contain a
 * 10 MiB image, so base64-encoding the canonical artifact inside another JSON request can cross
 * the gateway's 16 MiB body ceiling. Chunks keep every control request small without changing a
 * byte of the immutable artifact that WordPress ultimately downloads and verifies.
 */
export const GATEWAY_BLOB_FORMAT = 'pagecraft.gateway-blob.v1' as const;
export const GATEWAY_CONTROL_BODY_MAX = 16 * 1024 * 1024;
export const GATEWAY_BLOB_CHUNK_BYTES = 512 * 1024;

export interface GatewayBlobDescriptorV1 {
  format: typeof GATEWAY_BLOB_FORMAT;
  hash: string;
  bytes: number;
  chunkBytes: number;
  chunkCount: number;
}

export interface GatewayBlobChunkV1 {
  index: number;
  offset: number;
  bytes: number;
  hash: string;
  /** Standard padded base64. It is carried in one bounded gateway JSON request/response. */
  content: string;
}

const HASH = /^[0-9a-f]{64}$/;
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export function describeGatewayBlob(
  bytes: Uint8Array,
  chunkBytes = GATEWAY_BLOB_CHUNK_BYTES
): GatewayBlobDescriptorV1 {
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 1 || chunkBytes > 1024 * 1024) {
    throw new RangeError('gateway blob chunk size must be between 1 byte and 1 MiB');
  }
  return {
    format: GATEWAY_BLOB_FORMAT,
    hash: sha256(bytes),
    bytes: bytes.byteLength,
    chunkBytes,
    chunkCount: Math.ceil(bytes.byteLength / chunkBytes)
  };
}

export function splitGatewayBlob(
  bytes: Uint8Array,
  chunkBytes = GATEWAY_BLOB_CHUNK_BYTES
): { descriptor: GatewayBlobDescriptorV1; chunks: GatewayBlobChunkV1[] } {
  const descriptor = describeGatewayBlob(bytes, chunkBytes);
  const chunks: GatewayBlobChunkV1[] = [];
  for (let offset = 0, index = 0; offset < bytes.byteLength; offset += chunkBytes, index++) {
    const part = bytes.subarray(offset, Math.min(offset + chunkBytes, bytes.byteLength));
    chunks.push({
      index,
      offset,
      bytes: part.byteLength,
      hash: sha256(part),
      content: Buffer.from(part).toString('base64')
    });
  }
  return { descriptor, chunks };
}

export function validateGatewayBlobDescriptor(value: GatewayBlobDescriptorV1) {
  if (value.format !== GATEWAY_BLOB_FORMAT || !HASH.test(value.hash)) {
    throw new Error('invalid gateway blob descriptor');
  }
  if (!Number.isSafeInteger(value.bytes) || value.bytes < 0
    || !Number.isSafeInteger(value.chunkBytes) || value.chunkBytes < 1 || value.chunkBytes > 1024 * 1024
    || !Number.isSafeInteger(value.chunkCount) || value.chunkCount < 0
    || value.chunkCount !== Math.ceil(value.bytes / value.chunkBytes)) {
    throw new Error('invalid gateway blob dimensions');
  }
}

export function decodeGatewayBlobChunk(
  descriptor: GatewayBlobDescriptorV1,
  chunk: GatewayBlobChunkV1
): Uint8Array {
  validateGatewayBlobDescriptor(descriptor);
  if (!Number.isSafeInteger(chunk.index) || chunk.index < 0 || chunk.index >= descriptor.chunkCount
    || chunk.offset !== chunk.index * descriptor.chunkBytes
    || !Number.isSafeInteger(chunk.bytes) || chunk.bytes < 1 || chunk.bytes > descriptor.chunkBytes
    || !HASH.test(chunk.hash)) {
    throw new Error('invalid gateway blob chunk metadata');
  }
  const expectedBytes = Math.min(descriptor.chunkBytes, descriptor.bytes - chunk.offset);
  if (chunk.bytes !== expectedBytes) throw new Error('gateway blob chunk has the wrong length');
  const decoded = new Uint8Array(Buffer.from(chunk.content, 'base64'));
  if (decoded.byteLength !== chunk.bytes || sha256(decoded) !== chunk.hash) {
    throw new Error('gateway blob chunk failed integrity verification');
  }
  return decoded;
}

export function assembleGatewayBlob(
  descriptor: GatewayBlobDescriptorV1,
  chunks: Iterable<GatewayBlobChunkV1>
): Uint8Array {
  validateGatewayBlobDescriptor(descriptor);
  const ordered = [...chunks].sort((a, b) => a.index - b.index);
  if (ordered.length !== descriptor.chunkCount) throw new Error('gateway blob is incomplete');
  const output = new Uint8Array(descriptor.bytes);
  const seen = new Set<number>();
  for (const chunk of ordered) {
    if (seen.has(chunk.index)) throw new Error('gateway blob contains a duplicate chunk');
    seen.add(chunk.index);
    output.set(decodeGatewayBlobChunk(descriptor, chunk), chunk.offset);
  }
  if (sha256(output) !== descriptor.hash) throw new Error('gateway blob failed full integrity verification');
  return output;
}

/** Exact UTF-8 size of one JSON gateway request. Useful for enforcing the transport ceiling. */
export function gatewayControlRequestBytes(op: string, args: Record<string, unknown>) {
  return Buffer.byteLength(JSON.stringify({ op, args }), 'utf8');
}
