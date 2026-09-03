import { Hand, Shield, Target, Users, ArrowLeft, ArrowRight, Trophy } from 'lucide-react';

const POSITION_META = {
  goleiro: { label: 'GOL', title: 'Goleiro', Icon: Hand },
  fixo: { label: 'FIX', title: 'Fixo', Icon: Shield },
  libero: { label: 'LIB', title: 'Líbero', Icon: Target },
  meio: { label: 'MEI', title: 'Meio', Icon: Users },
  ala_esquerdo: { label: 'ALE', title: 'Ala Esquerdo', Icon: ArrowLeft },
  ala_direito: { label: 'ALD', title: 'Ala Direito', Icon: ArrowRight },
  pivo: { label: 'PIV', title: 'Pivô', Icon: Trophy },
};

export default function PositionTags({ player }) {
  const positions = Array.isArray(player?.positions)
    ? player.positions.filter((position) => POSITION_META[position])
    : [];

  if (positions.length === 0) return null;

  return (
    <span className="sf-position-tags" aria-label={`Posições: ${positions.map((position) => POSITION_META[position].title).join(', ')}`}>
      {positions.map((position) => {
        const { label, title, Icon } = POSITION_META[position];
        return (
          <span key={position} className="sf-position-tag" title={title} aria-label={title}>
            <Icon size={10} strokeWidth={2.5} /> {label}
          </span>
        );
      })}
    </span>
  );
}
