// User search text goes into a RegExp; escape it so "a.b" or "(" are literal, not patterns.
export default (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
