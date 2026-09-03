const fs = require('fs');
const path = 'app/society-page.js';
let s = fs.readFileSync(path, 'utf8');
const oldImport = "import { addGameParticipant, removeGameParticipant, toggleGameWaitlist, setGameCost, setGameGoalkeeperPays, setGamePixDetails, setGameOrganizer, setGameLocation, setGameMaxPlayers, setGameTeams } from '../lib/services/society-service';";
const newImport = "import { addGameParticipant, removeGameParticipant, toggleGameWaitlist, setGameCost, setGameGoalkeeperPays, setGamePixDetails as serviceSetGamePixDetails, setGameOrganizer as serviceSetGameOrganizer, setGameLocation as serviceSetGameLocation, setGameMaxPlayers, setGameTeams } from '../lib/services/society-service';";
if (!s.includes(oldImport)) throw new Error('service import not found');
s = s.replace(oldImport, newImport);
const fixes = [
  ["const { error } = await setGamePixDetails(gameId, { pixKey, pixReceiverName, pixCity, pixOwnerId });", "const { error } = await serviceSetGamePixDetails(gameId, { pixKey, pixReceiverName, pixCity, pixOwnerId });"],
  ["const { error } = await setGameOrganizer(gameId, organizerId);", "const { error } = await serviceSetGameOrganizer(gameId, organizerId);"],
  ["const { error } = await setGameLocation(gameId, { local, locationAddress, locationCity, locationState, locationLatitude, locationLongitude });", "const { error } = await serviceSetGameLocation(gameId, { local, locationAddress, locationCity, locationState, locationLatitude, locationLongitude });"],
];
for (const [oldText, newText] of fixes) {
  if (!s.includes(oldText)) throw new Error(`shadowed handler call not found: ${oldText.slice(0, 80)}`);
  s = s.replace(oldText, newText);
}
fs.writeFileSync(path, s);
console.log('Service handler shadowing fixed');
