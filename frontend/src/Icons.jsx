export const Icon = ({ name, size = 26 }) => {
  const paths = {
    filters: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>,
    list: <><path d="M3 6h14M3 11h14M3 16h8M17 14v8M13 18h8" /></>,
    cards: <><rect x="2" y="6" width="5" height="12" rx="1.5" /><rect x="9" y="3" width="6" height="18" rx="1.5" /><rect x="17" y="6" width="5" height="12" rx="1.5" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    back: <path d="m15 5-7 7 7 7" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
};

export const Logo = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" aria-label="Costream">
    <rect width="40" height="40" rx="10" fill="#f0b43c" />
    <path d="M14 10h12a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H14z" fill="#e24a3b" />
    <path d="M17 14.5v11l9-5.5z" fill="#fff" />
  </svg>
);
