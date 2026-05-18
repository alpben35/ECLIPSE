export const RANKS = [
  { name: 'Free', minDays: 0, price: 0 },
  { name: 'Champion', minDays: 180, price: 25 },
  { name: 'Master', minDays: 730, price: 150 },
  { name: 'Admin', minDays: 1825, price: 500 },
  { name: 'Temporary Owner', minDays: Infinity, price: 0 },
  { name: 'Owner', minDays: Infinity, price: 0 },
];

export const OWNER_EMAIL = 'alp.ben@gmail.com';

export const PROMPT_LIMITS = {
  free: 20,
  champion: 100,
  master: 500,
  admin: Infinity
};
