// Storage path builders. Only paths are stored in the database, never full URLs, so a later move to
// another object store leaves the schema untouched.
export const tempPath = (eventId: string, intentId: string) => `tmp/${eventId}/${intentId}`;
export const mediaPath = (eventId: string, mediaId: string) => `events/${eventId}/${mediaId}.jpg`;
export const thumbPath = (eventId: string, mediaId: string) => `events/${eventId}/${mediaId}.thumb.jpg`;
