import { UserRound } from 'lucide-react';
import {
  cardTier,
  computeOVR,
  primaryPositionAbbrev,
} from '../../lib/domain/player';

export function PlayerCard({ player, compact = false }) {
  const ovr = computeOVR(player);
  const tier = cardTier(ovr);
  const position = primaryPositionAbbrev(player);
  const firstName = (player.name || '?').trim().split(' ')[0];

  return (
    <div
      className={`sf-pcard ${compact ? 'sf-pcard-compact' : ''}`}
      style={{ background: tier.grad, color: tier.text }}
    >
      <div className="sf-pcard-top">
        <div className="sf-pcard-ovr">{ovr}</div>
        <div className="sf-pcard-pos">{position}</div>
      </div>

      <div className="sf-pcard-photo">
        {player.avatar_url ? (
          <img src={player.avatar_url} alt="" />
        ) : (
          <UserRound size={compact ? 26 : 46} color={tier.accent} />
        )}
      </div>

      <div className="sf-pcard-name">{firstName}</div>

      {!compact && (
        <div className="sf-pcard-stats">
          <div><span>{player.attr_ata ?? 50}</span><label>ATA</label></div>
          <div><span>{player.attr_def ?? 50}</span><label>DEF</label></div>
          <div><span>{player.attr_for ?? 50}</span><label>FOR</label></div>
          <div><span>{player.attr_hab ?? 50}</span><label>HAB</label></div>
        </div>
      )}

      <div className="sf-pcard-brand">SOCIETY</div>
    </div>
  );
}
