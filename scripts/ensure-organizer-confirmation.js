const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'app', 'page.js');
let s = fs.readFileSync(file, 'utf8');

const anchor = "    if (data) setSelectedGameId(data.id);";
if (!s.includes(anchor)) {
  throw new Error('organizer confirmation anchor not found');
}

const replacement = `    if (data) {\n      if (newGameOrganizerId) {\n        const { error: organizerConfirmationError } = await supabase\n          .from('game_confirmations')\n          .upsert({ game_id: data.id, user_id: newGameOrganizerId }, { onConflict: 'game_id,user_id' });\n        if (organizerConfirmationError) {\n          console.error('failed to confirm organizer in game', organizerConfirmationError);\n        }\n      }\n      setSelectedGameId(data.id);\n    }`;

s = s.replace(anchor, replacement);
fs.writeFileSync(file, s);
console.log('Selected organizer is automatically confirmed for the new game.');
