// Parses an age rating string like "13+", "All Ages", "5+" into a minimum age number.
export function parseMinAge(rating?: string | null): number {
  if (!rating) return 0;
  const r = rating.trim().toLowerCase();
  if (r === "all ages" || r === "all" || r === "") return 0;
  const m = r.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// Returns true if a student of the given age is allowed to see/borrow a book
// with the given age rating. If the student's age is unknown, restrict to
// books without an age requirement.
export function isAgeAppropriate(
  studentAge: number | null | undefined,
  rating?: string | null
): boolean {
  const min = parseMinAge(rating);
  if (min === 0) return true;
  if (studentAge == null) return false;
  return studentAge >= min;
}
