import fs from 'node:fs';

const files = ['server/src/stream.js', 'server/src/routes/mt.js'];

for (const f of files) {
  const buf = Buffer.from(fs.readFileSync(f));
  const needle = Buffer.from('bytes=');
  const pos = buf.indexOf(needle);
  if (pos === -1) { console.log('no bytes= in ' + f); continue; }

  // After 'bytes=(' we expect: \ \ d * ) - ( \ \ d *
  // (two backslashes before each 'd')
  // We want:          \ d * ) - ( \ d *
  // (one backslash before each 'd')

  // Check what's actually there
  const region = buf.subarray(pos, pos + 30);
  console.log(f + ' region:', region.toString('hex'));
  console.log(f + ' as text:', JSON.stringify(region.toString()));

  // Brute force: replace every occurrence of the 3-byte sequence [0x5c, 0x5c, 0x64] (\ \ d)
  // with [0x5c, 0x64] (\ d) -- but ONLY within the regex line (between 'bytes=' and '.exec')
  let start = pos;
  let end = buf.indexOf('.exec', pos);
  if (end === -1) end = pos + 100;
  
  // Work on the region
  let regionStr = buf.subarray(start, end).toString('utf8');
  console.log('regionStr:', JSON.stringify(regionStr));
  
  // The region contains: bytes=(\\d*)-(\\d*)/  (with \\ = two backslash chars)
  // We want: bytes=(\d*)-(\d*)/  (with \ = one backslash char)
  // Replace \\d -> \d (two-backslash-d to one-backslash-d)
  const oldRegion = regionStr;
  regionStr = regionStr.split(String.fromCharCode(0x5c) + String.fromCharCode(0x5c) + 'd').join(String.fromCharCode(0x5c) + 'd');
  console.log('oldRegion:', JSON.stringify(oldRegion));
  console.log('newRegion:', JSON.stringify(regionStr));
  
  if (regionStr !== oldRegion) {
    // Replace the region in the buffer
    const newContent = buf.subarray(0, start).toString('utf8') + regionStr + buf.subarray(end).toString('utf8');
    fs.writeFileSync(f, newContent);
    console.log('FIXED: ' + f);
  } else {
    console.log('NOT FIXED: ' + f + ' (no double-backslash-d found in region)');
  }
}

