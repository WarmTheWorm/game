// ---------- writing a zip ----------
// Stored, not deflated: the whole point is a folder that unzips into
// assetpacks/, and PNG and mp3 are already compressed.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function zipBlob(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const head = n => { const b = new Uint8Array(n); return { b, v: new DataView(b.buffer) }; };

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);

    const local = head(30);
    local.v.setUint32(0, 0x04034b50, true);
    local.v.setUint16(4, 20, true);
    local.v.setUint16(8, 0, true);          // stored
    local.v.setUint32(14, crc, true);
    local.v.setUint32(18, data.length, true);
    local.v.setUint32(22, data.length, true);
    local.v.setUint16(26, nameBytes.length, true);
    chunks.push(local.b, nameBytes, data);

    const dir = head(46);
    dir.v.setUint32(0, 0x02014b50, true);
    dir.v.setUint16(4, 20, true);
    dir.v.setUint16(6, 20, true);
    dir.v.setUint16(10, 0, true);
    dir.v.setUint32(16, crc, true);
    dir.v.setUint32(20, data.length, true);
    dir.v.setUint32(24, data.length, true);
    dir.v.setUint16(28, nameBytes.length, true);
    dir.v.setUint32(42, offset, true);
    central.push(dir.b, nameBytes);

    offset += local.b.length + nameBytes.length + data.length;
  }

  const dirSize = central.reduce((n, c) => n + c.length, 0);
  const tail = head(22);
  tail.v.setUint32(0, 0x06054b50, true);
  tail.v.setUint16(8, files.length, true);
  tail.v.setUint16(10, files.length, true);
  tail.v.setUint32(12, dirSize, true);
  tail.v.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, tail.b], { type: 'application/zip' });
}
