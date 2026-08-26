/** Binary chunk validation kept separate from the gateway dispatcher so the transport contract
    can be checked with Deno without a database or a deployed Edge Function. */
export const GATEWAY_BLOB_FORMAT = "pagecraft.gateway-blob.v1" as const;
export const GATEWAY_BLOB_MAX_CHUNK_BYTES = 1024 * 1024;
export const GATEWAY_ASSET_BLOB_MAX_BYTES = 10 * 1024 * 1024;

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
  content: string;
}

export interface StoredGatewayBlobChunkV1 {
  index: number;
  bytes: number;
  hash: string;
  content: Uint8Array;
}

const HASH = /^[0-9a-f]{64}$/;

export const hexSha256 = async (bytes: Uint8Array) => {
  const input = Uint8Array.from(bytes).buffer as ArrayBuffer;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export function validateBlobDescriptor(
  value: unknown,
): GatewayBlobDescriptorV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid gateway blob descriptor");
  }
  const blob = value as Record<string, unknown>;
  if (
    blob.format !== GATEWAY_BLOB_FORMAT || typeof blob.hash !== "string" ||
    !HASH.test(blob.hash) ||
    !Number.isSafeInteger(blob.bytes) || Number(blob.bytes) < 0 ||
    !Number.isSafeInteger(blob.chunkBytes) || Number(blob.chunkBytes) < 1 ||
    Number(blob.chunkBytes) > GATEWAY_BLOB_MAX_CHUNK_BYTES ||
    !Number.isSafeInteger(blob.chunkCount) || Number(blob.chunkCount) < 0 ||
    Number(blob.chunkCount) !==
      Math.ceil(Number(blob.bytes) / Number(blob.chunkBytes))
  ) {
    throw new Error("invalid gateway blob descriptor");
  }
  return blob as unknown as GatewayBlobDescriptorV1;
}

/** Editor assets have a tighter product limit than release artifacts. Keeping the check beside
 * the shared descriptor validation lets the Edge dispatcher and its database-free tests enforce
 * the same exact boundary. */
export function validateAssetBlobDescriptor(
  value: unknown,
): GatewayBlobDescriptorV1 {
  const blob = validateBlobDescriptor(value);
  if (blob.bytes < 1 || blob.bytes > GATEWAY_ASSET_BLOB_MAX_BYTES) {
    throw new Error("asset blob exceeds the allowed size");
  }
  return blob;
}

const decodeBase64 = (content: string) => {
  let binary: string;
  try {
    binary = atob(content);
  } catch {
    throw new Error("invalid gateway blob chunk content");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export async function validateBlobChunk(
  descriptorValue: unknown,
  chunkValue: unknown,
): Promise<
  {
    descriptor: GatewayBlobDescriptorV1;
    chunk: GatewayBlobChunkV1;
    content: Uint8Array;
  }
> {
  const descriptor = validateBlobDescriptor(descriptorValue);
  if (
    !chunkValue || typeof chunkValue !== "object" || Array.isArray(chunkValue)
  ) {
    throw new Error("invalid gateway blob chunk metadata");
  }
  const value = chunkValue as Record<string, unknown>;
  if (
    !Number.isSafeInteger(value.index) || Number(value.index) < 0 ||
    Number(value.index) >= descriptor.chunkCount ||
    value.offset !== Number(value.index) * descriptor.chunkBytes ||
    !Number.isSafeInteger(value.bytes) || Number(value.bytes) < 1 ||
    Number(value.bytes) > descriptor.chunkBytes ||
    typeof value.hash !== "string" || !HASH.test(value.hash) ||
    typeof value.content !== "string"
  ) {
    throw new Error("invalid gateway blob chunk metadata");
  }
  const chunk = value as unknown as GatewayBlobChunkV1;
  const expected = Math.min(
    descriptor.chunkBytes,
    descriptor.bytes - chunk.offset,
  );
  if (chunk.bytes !== expected) {
    throw new Error("gateway blob chunk has the wrong length");
  }
  const content = decodeBase64(chunk.content);
  if (
    content.byteLength !== chunk.bytes ||
    await hexSha256(content) !== chunk.hash
  ) {
    throw new Error("gateway blob chunk failed integrity verification");
  }
  return { descriptor, chunk, content };
}

export async function assembleStoredGatewayBlob(
  descriptorValue: unknown,
  chunks: StoredGatewayBlobChunkV1[],
): Promise<Uint8Array> {
  const descriptor = validateBlobDescriptor(descriptorValue);
  const ordered = [...chunks].sort((a, b) => a.index - b.index);
  if (ordered.length !== descriptor.chunkCount) {
    throw new Error("gateway blob is incomplete");
  }
  const output = new Uint8Array(descriptor.bytes);
  for (let index = 0; index < ordered.length; index++) {
    const chunk = ordered[index];
    const offset = index * descriptor.chunkBytes;
    const expected = Math.min(descriptor.chunkBytes, descriptor.bytes - offset);
    if (
      chunk.index !== index || chunk.bytes !== expected ||
      chunk.content.byteLength !== expected || !HASH.test(chunk.hash) ||
      await hexSha256(chunk.content) !== chunk.hash
    ) {
      throw new Error("gateway blob chunk failed integrity verification");
    }
    output.set(chunk.content, offset);
  }
  if (await hexSha256(output) !== descriptor.hash) {
    throw new Error("gateway blob failed full integrity verification");
  }
  return output;
}
