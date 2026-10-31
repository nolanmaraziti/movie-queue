// Small line icons used around the app. They inherit the text color.
const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const SearchIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={2.2}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></svg>
);
export const PlusIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>
);
export const BackIcon = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" {...base} strokeWidth={2.2}><path d="M15 5l-7 7 7 7" /></svg>
);
export const ChevronIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" {...base}><path d="M9 6l6 6-6 6" /></svg>
);
export const CheckIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" {...base} strokeWidth={2.6}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const XIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={2.2}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const QueueIcon = () => (
  <svg width={24} height={24} viewBox="0 0 24 24" {...base}><path d="M4 6h12M4 12h12M4 18h8" /><path d="M19 15v6M16 18h6" /></svg>
);
export const NightsIcon = () => (
  <svg width={24} height={24} viewBox="0 0 24 24" {...base}><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M8 3l4 4 4-4" /></svg>
);
export const FriendsIcon = () => (
  <svg width={24} height={24} viewBox="0 0 24 24" {...base}>
    <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14.5c2.3 0 4 1.5 4.5 4" />
  </svg>
);
