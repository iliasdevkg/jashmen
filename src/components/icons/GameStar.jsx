// Premium "star token" — replaces the flat lucide Star inside an available
// lesson node's sphere. Same glossy-gem art direction as the league badges
// (gradient fill, glass highlight, thin dark outline, tiny glint) scaled
// down to a 30px token so it reads as a jewel, not a line icon.

import { useId } from 'react';

const STAR_PATH =
  'M50,8 L59.99,36.25 L89.95,37.02 L66.17,55.25 L74.69,83.98 L50,67 ' +
  'L25.31,83.98 L33.83,55.25 L10.05,37.02 L40.01,36.25 Z';

export default function GameStar({ size = 30 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fillId = `gs-fill-${uid}`;
  const glossId = `gs-gloss-${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <radialGradient id={fillId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="65%" stopColor="#f4f8ff" />
          <stop offset="100%" stopColor="#cfe0f5" />
        </radialGradient>
        <radialGradient id={glossId} cx="34%" cy="24%" r="45%">
          <stop offset="0%" stopColor="white" stopOpacity="0.9" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>

      <path d={STAR_PATH} fill="black" opacity="0.16" transform="translate(0 2.5)" />
      <path d={STAR_PATH} fill={`url(#${fillId})`} stroke="rgba(15,23,42,0.18)" strokeWidth="3" strokeLinejoin="round" />
      <path d={STAR_PATH} fill={`url(#${glossId})`} />
      <circle cx="63" cy="24" r="4" fill="white" opacity="0.9" />
    </svg>
  );
}
