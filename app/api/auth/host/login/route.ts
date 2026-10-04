import { badRequest, unauthorized } from "@/lib/auth/errors";
import { route } from "@/lib/auth/errors";
import { verifyPassword } from "@/lib/auth/password";
import { createHostSession } from "@/lib/auth/host";
import { recordFailedLogin, recordSuccessfulLogin, setLocked, findHostByEmail } from "@/lib/queries/hosts";
import { parseJsonBody, requireEmail } from "@/lib/validate";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export const POST = route(async (request) => {
  const body = await parseJsonBody(request);
  const email = requireEmail(body.email);
  const password = body.password;

  if (typeof password !== "string" || !password) throw badRequest("Enter your password");

  const host = await findHostByEmail(email);

  // Host not found or deleted: run dummy hash to equalize timing
  if (!host || host.deletedAt) {
    await verifyPassword(password, "$2a$12$R9h7cIPz0gi.URNNF3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW");
    throw unauthorized();
  }

  // Check if locked
  if (host.lockedUntil && host.lockedUntil > new Date()) {
    throw unauthorized();
  }

  // Verify password
  const valid = await verifyPassword(password, host.passwordHash);
  if (!valid) {
    const newCount = host.failedLoginCount + 1;
    await recordFailedLogin(host.id);
    if (newCount >= MAX_ATTEMPTS) {
      await setLocked(host.id, LOCKOUT_MINUTES);
    }
    throw unauthorized();
  }

  // Success: reset counter and create session
  await recordSuccessfulLogin(host.id);
  await createHostSession(host.id);

  return new Response(JSON.stringify({ email: host.email }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
