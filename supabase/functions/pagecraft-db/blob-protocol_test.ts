import {
  assembleStoredGatewayBlob,
  GATEWAY_ASSET_BLOB_MAX_BYTES,
  GATEWAY_BLOB_FORMAT,
  hexSha256,
  validateAssetBlobDescriptor,
  validateBlobChunk,
  validateBlobDescriptor,
} from "./blob-protocol.ts";

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: ${actual} !== ${expected}`);
  }
};

Deno.test("gateway blob chunks are content-addressed and bounded", async () => {
  const content = new Uint8Array(512 * 1024);
  content.fill(0x51);
  const hash = await hexSha256(content);
  const descriptor = {
    format: GATEWAY_BLOB_FORMAT,
    hash,
    bytes: content.byteLength,
    chunkBytes: content.byteLength,
    chunkCount: 1,
  };
  const binary = String.fromCharCode(...content.subarray(0, 0x8000)) +
    Array.from(
      { length: content.byteLength / 0x8000 - 1 },
      (_, part) =>
        String.fromCharCode(
          ...content.subarray((part + 1) * 0x8000, (part + 2) * 0x8000),
        ),
    ).join("");
  const chunk = {
    index: 0,
    offset: 0,
    bytes: content.byteLength,
    hash,
    content: btoa(binary),
  };
  const valid = await validateBlobChunk(descriptor, chunk);
  equal(valid.content.byteLength, content.byteLength, "decoded bytes");
  equal(await hexSha256(valid.content), descriptor.hash, "content hash");
  equal(
    validateBlobDescriptor(descriptor).chunkCount,
    1,
    "descriptor chunk count",
  );
  const assembled = await assembleStoredGatewayBlob(descriptor, [{
    index: 0,
    bytes: content.byteLength,
    hash,
    content,
  }]);
  equal(await hexSha256(assembled), hash, "stored chunk assembly");
});

Deno.test("gateway blob validation rejects corruption and oversized chunk declarations", async () => {
  const content = new Uint8Array([1, 2, 3]);
  const hash = await hexSha256(content);
  const descriptor = {
    format: GATEWAY_BLOB_FORMAT,
    hash,
    bytes: 3,
    chunkBytes: 3,
    chunkCount: 1,
  };
  let corrupt = false;
  try {
    await validateBlobChunk(descriptor, {
      index: 0,
      offset: 0,
      bytes: 3,
      hash,
      content: btoa(String.fromCharCode(1, 2, 4)),
    });
  } catch {
    corrupt = true;
  }
  equal(corrupt, true, "corrupt chunk rejection");
  let oversized = false;
  try {
    validateBlobDescriptor({
      ...descriptor,
      chunkBytes: 1024 * 1024 + 1,
      chunkCount: 1,
    });
  } catch {
    oversized = true;
  }
  equal(oversized, true, "oversized descriptor rejection");
});

Deno.test("a maximum-size editor asset reconstructs exactly and the next byte fails closed", async () => {
  const chunkBytes = 512 * 1024;
  const content = new Uint8Array(GATEWAY_ASSET_BLOB_MAX_BYTES);
  for (let index = 0; index < content.byteLength; index++) {
    content[index] = (index * 31 + 17) & 0xff;
  }
  const descriptor = {
    format: GATEWAY_BLOB_FORMAT,
    hash: await hexSha256(content),
    bytes: content.byteLength,
    chunkBytes,
    chunkCount: content.byteLength / chunkBytes,
  };
  const chunks = [];
  for (let index = 0; index < descriptor.chunkCount; index++) {
    const part = content.slice(index * chunkBytes, (index + 1) * chunkBytes);
    chunks.push({
      index,
      bytes: part.byteLength,
      hash: await hexSha256(part),
      content: part,
    });
  }
  equal(
    validateAssetBlobDescriptor(descriptor).bytes,
    GATEWAY_ASSET_BLOB_MAX_BYTES,
    "asset maximum",
  );
  const assembled = await assembleStoredGatewayBlob(
    descriptor,
    [...chunks].reverse(),
  );
  equal(assembled.byteLength, content.byteLength, "assembled asset bytes");
  equal(await hexSha256(assembled), descriptor.hash, "assembled asset hash");

  let tooLarge = false;
  try {
    validateAssetBlobDescriptor({
      ...descriptor,
      bytes: GATEWAY_ASSET_BLOB_MAX_BYTES + 1,
      chunkCount: descriptor.chunkCount + 1,
    });
  } catch {
    tooLarge = true;
  }
  equal(tooLarge, true, "asset maximum plus one rejection");
});
