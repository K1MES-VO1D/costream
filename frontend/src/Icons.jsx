export const Icon = ({ name, size = 26 }) => {
  const paths = {
    filters: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>,
    list: <><path d="M3 6h14M3 11h14M3 16h8M17 14v8M13 18h8" /></>,
    cards: <><rect x="2" y="6" width="5" height="12" rx="1.5" /><rect x="9" y="3" width="6" height="18" rx="1.5" /><rect x="17" y="6" width="5" height="12" rx="1.5" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    back: <path d="m15 5-7 7 7 7" />,
    next: <path d="m9 5 7 7-7 7" />,
    play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" />,
    check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    plus: <path d="M12 5v14M5 12h14" />,
    bookmark: <path d="M7 4h10v16l-5-3.5L7 20z" />,
    tv: <><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M9 21h6" /></>,
    wallet: <><path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1z" /><path d="M4 7V6a2 2 0 0 1 2-2h10M16 14h2" /></>,
    swipe: <><path d="M4 12h12M12 8l4 4-4 4" /><path d="M20 6v12" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
};

export const Logo = () => (
  <svg width="38" height="38" viewBox="0 0 40 40" aria-label="Difonti">
    <rect width="40" height="40" rx="12" fill="#e8b86a" />
    <path d="M14 11h6.5a9 9 0 0 1 0 18H14z" fill="none" stroke="#10242f" strokeWidth="3" strokeLinejoin="round" />
    <circle cx="21" cy="20" r="2.4" fill="#10242f" />
  </svg>
);
