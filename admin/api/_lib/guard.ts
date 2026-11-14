import { RuleError } from './bookings.js';
import { bad } from './http.js';

/** Gör regelbrott (RuleError) till 400-svar med begriplig text; andra fel blir 500. */
export async function guard(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof RuleError) return bad(e.message);
    console.error(e);
    return bad('Något gick fel. Försök igen.', 500);
  }
}
