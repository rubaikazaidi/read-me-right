/**
 * Escapes special characters in ILIKE patterns to prevent SQL pattern injection.
 * Characters escaped: %, _, \
 */
export const escapeILikePattern = (str: string): string => {
  return str.replace(/[%_\\]/g, '\\$&');
};

/**
 * Validates a search term for basic safety.
 * Returns true if valid, false if invalid.
 */
export const isValidSearchTerm = (term: string): boolean => {
  if (!term.trim() || term.length < 1) {
    return false;
  }
  // Allow letters, numbers, spaces, and common punctuation
  return /^[a-zA-Z0-9\s@._-]+$/.test(term);
};
