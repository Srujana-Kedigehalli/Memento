/** Sends one plain-text email. Throws on failure. Implementations never log bodies or credentials. */
export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
}
