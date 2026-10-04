// The version of the audience disclosure a guest agrees to before their first upload in an event.
// Bump it when the wording changes materially; guests are then asked again.
export const CONSENT_VERSION = 1;

export function consentDisclosure(eventName: string): { title: string; paragraphs: string[] } {
  return {
    title: `Share photos at "${eventName}"`,
    paragraphs: [
      "Photos you add here can be seen by anyone who has this event's link, which may include people beyond the invited guests if the link is passed on.",
      "The host of this event can see who added each photo, and can remove any photo. You can delete your own photos at any time.",
      "By continuing you agree to share the photos you add with that audience.",
    ],
  };
}
