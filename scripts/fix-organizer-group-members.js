const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'app', 'page.js');
let s = fs.readFileSync(file, 'utf8');

// The organizer build-time patch injects groupMembers.some(...) into both
// GameDetail and the new-game selector. Keep the UI safe while group membership
// data is still loading or unavailable.
s = s.replaceAll('groupMembers.some(', '(groupMembers || []).some(');

fs.writeFileSync(file, s);
console.log('Organizer group-members safety patch applied.');
