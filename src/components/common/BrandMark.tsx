import React from 'react';

/** Studio mark: a question mark on the brand red with a small gold check (question → solution). */
export const BrandMark: React.FC<{ size?: number; className?: string }> = ({ size = 32, className }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" className={className} role="img" aria-label="Soru Stüdyosu">
    <rect x="1" y="1" width="46" height="46" rx="13" fill="#8B1E2D" />
    <path d="M16.5 17.5a7.5 7.5 0 1 1 11 6.6c-2.2 1.2-3.5 2.6-3.5 5.1v1.3" fill="none" stroke="#FFFFFF" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="24" cy="37" r="2.8" fill="#FFFFFF" />
    <circle cx="37" cy="37" r="7.2" fill="#F2C14E" />
    <path d="M33.6 37.2l2.3 2.3 4.3-4.6" fill="none" stroke="#5A1420" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
