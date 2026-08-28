const fs = require('fs');
const target = 'scripts/apply-group-image-avatar.js';
let script = fs.readFileSync(target, 'utf8');
const from = 'const filePath = \\`${group.id}/${myId}/${Date.now()}-${safeName}\\`;';
const to = "const filePath = group.id + '/' + myId + '/' + Date.now() + '-' + safeName;";
if (!script.includes(from)) throw new Error('Expected avatar upload path anchor not found');
script = script.replace(from, to);
fs.writeFileSync(target, script);
require('./apply-group-image-avatar.js');
