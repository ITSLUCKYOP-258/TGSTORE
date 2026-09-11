import fs from 'node:fs';

// Read each file and fix the double-backslash regex.
// In the file source: /bytes=(\\d*)-(\\d*)/  -- the \\ is two literal backslash chars
// We want:              /bytes=(\d*)-(\d*)/  -- single backslash

const files = ['server/src/stream.js', 'server/src/routes/mt.js'];

for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  // Build the search/replace using Buffer to avoid escaping confusion
  const buf = Buffer.from(c);
  // Find 'bytes=' in the buffer
  const needle = Buffer.from('bytes=');
  const pos = buf.indexOf(needle);
  if (pos === -1) { console.log('no bytes= in ' + f); continue; }
  // Show a hex dump of the 20 bytes after 'bytes='
  const start = pos + needle.length;
  const segment = buf.subarray(start, start + 20);
  console.log(f + ': hex around bytes= ...', segment.toString('hex'), '->', segment.toString());
  // The file has two backslash chars (0x5c 0x5c) before 'd'
  // We want to replace those two backslashes with one (0x5c)
  // Do a byte-level replacement: replace 0x5c 0x5c 0x64 with 0x5c 0x64
  // But only within the regex line. Let's do a targeted string replace.
  // The exact string in the file (as a JS string value) is:
  //   bytes=(\\d*)-(\\d*)   where \\ = two backslash chars
  // In JS source code, to write that string literal we need \\\\ for each pair:
  //   'bytes=(\\\\\\\\d*)-(\\\\\\\\d*)'  -> NO that's 4 backslashes per pair
  // Actually: to represent two backslash chars in a JS string literal: '\\\\'  (4 chars in source = 2 chars in value)
  // So to find 'bytes=(\\d*)-(\\d*)' (with 2 backslash chars before d):
  const findStr = 'bytes=(' + String.raw`\` + `\` + 'd*)-(' + String.raw`\` + `\` + 'd*)';
  const replStr = 'bytes=(' + String.raw`\` + 'd*)-(' + String.raw`\` + 'd*)';
  console.log('  findStr value:', JSON.stringify(findStr));
  console.log('  replStr value:', JSON.stringify(replStr));
  const before = c;
  c = c.split(findStr).join(replStr);
  if (c !== before) {
    fs.writeFileSync(f, c);
    console.log('  FIXED: ' + f);
  } else {
    console.log('  NOT FOUND in: ' + f);
  }
}

