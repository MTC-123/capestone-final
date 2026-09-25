/**
 * Prisma's MongoDB connector treats `{ field: null }` as "stored as null" and
 * does NOT match documents where the optional field was never written. Use
 * this for "not set yet" filters (not revoked, not relieved, not rotated…).
 */
export function unset<K extends string>(field: K) {
  return { OR: [{ [field]: null }, { [field]: { isSet: false } }] } as { OR: Array<Record<K, null | { isSet: false }>> };
}
