// Premium "checkpoint token" — the graduation-cap sibling of GameStar.
// Marks the last node of a module's path (and the preview sheet's header
// chip when that node is opened) so a checkpoint reads as visually
// distinct from a regular practice node at a glance, same glossy-gem
// material as GameStar so the two feel like one family.

import { useId } from 'react';

export default function GameCap({ size = 30 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fillId = `gc-fill-${uid}`;
  const glossId = `gc-gloss-${uid}`;

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

      <g transform="translate(0 2.5)" opacity="0.16" fill="black" stroke="black">
        <path d="M50,20 L84,42 L50,60 L16,42 Z" />
        <rect x="33" y="52" width="34" height="15" rx="7.5" />
        <path d="M84,42 L88,64" strokeWidth="4.5" fill="none" />
        <circle cx="88.5" cy="68" r="5.5" />
      </g>

      <g fill={`url(#${fillId})`} stroke="rgba(15,23,42,0.18)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <path d="M50,20 L84,42 L50,60 L16,42 Z" />
        <rect x="33" y="52" width="34" height="15" rx="7.5" />
        <path d="M84,42 L88,64" strokeWidth="4.5" fill="none" />
        <circle cx="88.5" cy="68" r="5.5" strokeWidth="2.4" />
      </g>

      <g fill={`url(#${glossId})`}>
        <path d="M50,20 L84,42 L50,60 L16,42 Z" />
        <rect x="33" y="52" width="34" height="15" rx="7.5" />
      </g>
      <circle cx="63" cy="34" r="3.4" fill="white" opacity="0.9" />
    </svg>
  );
}
