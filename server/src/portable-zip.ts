import { inflateRawSync } from 'node:zlib';
import { crc32 } from '../../app/src/core/index.ts';
import { PORTABLE_PACKAGE_LIMITS_V1 } from '../../app/src/package/types.ts';
import { utf8ByteCompare } from './releases.ts';

export interface PortableZipEntry {
  path: string;
  bytes: Uint8Array;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

const u16 = (value: number) => {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, value, true);
  return out;
};
const u32 = (value: number) => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, true);
  return out;
};
const concat = (parts: readonly Uint8Array[]) => {
  const size = parts.reduce((total, part) => total + part.byteLength, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.byteLength; }
  return out;
};

export function assertPortablePath(path: string) {
  const bytes = encoder.encode(path);
  if (!path || bytes.byteLength > PORTABLE_PACKAGE_LIMITS_V1.pathBytes
    || path.startsWith('/') || path.endsWith('/') || path.includes('\\') || path.includes('\0')) {
    throw new Error(`portable package contains unsafe path: ${JSON.stringify(path)}`);
  }
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) {
    throw new Error(`portable package contains path traversal: ${JSON.stringify(path)}`);
  }
}

/** A deterministic store-only ZIP. Entry order and DOS timestamps are fixed. */
export function createPortableZip(input: readonly PortableZipEntry[]): Uint8Array {
  if (input.length > PORTABLE_PACKAGE_LIMITS_V1.files) {
    throw new Error(`portable package exceeds ${PORTABLE_PACKAGE_LIMITS_V1.files} files`);
  }
  const entries = input.map(entry => ({ path: entry.path, bytes: new Uint8Array(entry.bytes) }))
    .sort((left, right) => utf8ByteCompare(left.path, right.path));
  const seen = new Set<string>();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  let expanded = 0;
  for (const entry of entries) {
    assertPortablePath(entry.path);
    const folded = entry.path.toLowerCase();
    if (seen.has(folded)) throw new Error(`portable package repeats path: ${entry.path}`);
    seen.add(folded);
    if (entry.bytes.byteLength > PORTABLE_PACKAGE_LIMITS_V1.fileBytes) {
      throw new Error(`portable package file is too large: ${entry.path}`);
    }
    expanded += entry.bytes.byteLength;
    if (expanded > PORTABLE_PACKAGE_LIMITS_V1.expandedBytes) {
      throw new Error('portable package expanded bytes exceed the v1 limit');
    }
    const name = encoder.encode(entry.path);
    const crc = crc32(entry.bytes);
    const head = concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21),
      u32(crc), u32(entry.bytes.byteLength), u32(entry.bytes.byteLength),
      u16(name.byteLength), u16(0), name
    ]);
    local.push(head, entry.bytes);
    central.push(concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21),
      u32(crc), u32(entry.bytes.byteLength), u32(entry.bytes.byteLength),
      u16(name.byteLength), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name
    ]));
    offset += head.byteLength + entry.bytes.byteLength;
  }
  const centralBytes = concat(central);
  const archive = concat([
    ...local,
    centralBytes,
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralBytes.byteLength), u32(offset), u16(0)
  ]);
  if (archive.byteLength > PORTABLE_PACKAGE_LIMITS_V1.archiveBytes) {
    throw new Error('portable package archive exceeds the v1 limit');
  }
  return archive;
}

const viewAt = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const findEnd = (view: DataView) => {
  const floor = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let at = view.byteLength - 22; at >= floor; at--) {
    if (view.getUint32(at, true) === 0x06054b50) return at;
  }
  return -1;
};

/** Strict bounded extraction. ZIP64, encryption, descriptors, comments, and symlinks fail. */
export function extractPortableZip(archive: Uint8Array): Map<string, Uint8Array> {
  if (archive.byteLength > PORTABLE_PACKAGE_LIMITS_V1.archiveBytes) {
    throw new Error('portable package archive exceeds the v1 limit');
  }
  if (archive.byteLength < 22) throw new Error('portable package is not a complete ZIP archive');
  const view = viewAt(archive);
  const end = findEnd(view);
  if (end < 0) throw new Error('portable package ZIP end record is missing');
  const disk = view.getUint16(end + 4, true);
  const centralDisk = view.getUint16(end + 6, true);
  const diskEntries = view.getUint16(end + 8, true);
  const entries = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  const commentLength = view.getUint16(end + 20, true);
  if (disk || centralDisk || diskEntries !== entries) throw new Error('multi-disk portable packages are not supported');
  if (commentLength || end + 22 !== archive.byteLength) throw new Error('portable package ZIP comments or trailing bytes are not supported');
  if (entries > PORTABLE_PACKAGE_LIMITS_V1.files) {
    throw new Error(`portable package exceeds ${PORTABLE_PACKAGE_LIMITS_V1.files} files`);
  }
  if (centralOffset + centralSize !== end || centralOffset > archive.byteLength) {
    throw new Error('portable package central directory is malformed');
  }

  const files = new Map<string, Uint8Array>();
  const folded = new Set<string>();
  let at = centralOffset;
  let expanded = 0;
  for (let index = 0; index < entries; index++) {
    if (at + 46 > end || view.getUint32(at, true) !== 0x02014b50) {
      throw new Error('portable package central entry is malformed');
    }
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const compressedSize = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const entryComment = view.getUint16(at + 32, true);
    const diskStart = view.getUint16(at + 34, true);
    const external = view.getUint32(at + 38, true);
    const localOffset = view.getUint32(at + 42, true);
    const centralEnd = at + 46 + nameLength + extraLength + entryComment;
    if (centralEnd > end) throw new Error('portable package central entry exceeds the archive');
    if (flags & ~0x0800 || diskStart || ![0, 8].includes(method)) {
      throw new Error('portable package uses unsupported ZIP features');
    }
    if ((((external >>> 16) & 0o170000) === 0o120000)) {
      throw new Error('portable package symlinks are not allowed');
    }
    if (size > PORTABLE_PACKAGE_LIMITS_V1.fileBytes) throw new Error('portable package entry exceeds the file limit');
    expanded += size;
    if (expanded > PORTABLE_PACKAGE_LIMITS_V1.expandedBytes) {
      throw new Error('portable package expanded bytes exceed the v1 limit');
    }
    let path: string;
    try { path = decoder.decode(archive.subarray(at + 46, at + 46 + nameLength)); }
    catch { throw new Error('portable package path is not valid UTF-8'); }
    assertPortablePath(path);
    const key = path.toLowerCase();
    if (folded.has(key)) throw new Error(`portable package repeats path: ${path}`);
    folded.add(key);

    if (localOffset + 30 > centralOffset || view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error(`portable package local entry is malformed: ${path}`);
    }
    const localFlags = view.getUint16(localOffset + 6, true);
    const localMethod = view.getUint16(localOffset + 8, true);
    const localCrc = view.getUint32(localOffset + 14, true);
    const localCompressed = view.getUint32(localOffset + 18, true);
    const localSize = view.getUint32(localOffset + 22, true);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (localFlags !== flags || localMethod !== method || localCrc !== crc
      || localCompressed !== compressedSize || localSize !== size || dataEnd > centralOffset) {
      throw new Error(`portable package local metadata disagrees: ${path}`);
    }
    let localPath: string;
    try { localPath = decoder.decode(archive.subarray(localOffset + 30, localOffset + 30 + localNameLength)); }
    catch { throw new Error('portable package local path is not valid UTF-8'); }
    if (localPath !== path) throw new Error(`portable package local path disagrees: ${path}`);
    const packed = archive.subarray(dataStart, dataEnd);
    let bytes: Uint8Array;
    try { bytes = method === 8 ? new Uint8Array(inflateRawSync(packed)) : new Uint8Array(packed); }
    catch { throw new Error(`portable package entry could not be expanded: ${path}`); }
    if (bytes.byteLength !== size || crc32(bytes) !== crc) {
      throw new Error(`portable package entry failed integrity verification: ${path}`);
    }
    files.set(path, bytes);
    at = centralEnd;
  }
  if (at !== end) throw new Error('portable package central directory has unparsed bytes');
  return files;
}
