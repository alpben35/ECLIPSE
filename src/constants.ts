export const RANKS = [
  { name: 'Basic', minDays: 0, price: 0 },
  { name: 'Premium', minDays: 90, price: 15 },
  { name: 'Admin', minDays: 1825, price: 250 },
  { name: 'Temporary Owner', minDays: Infinity, price: 0 },
  { name: 'Owner', minDays: Infinity, price: 0 },
];

export const OWNER_EMAIL = 'alp.ben@gmail.com';

export const PROMPT_LIMITS = {
  free: 15,
  basic: 15,
  serious: 40,
  premium: 500,
  admin: Infinity,
  owner: Infinity
};
