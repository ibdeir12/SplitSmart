import { ValidationError } from "./errors";

/** Largest accepted expense amount, in cents (100,000.00 USD, spec FR-016). */
export const MAX_AMOUNT_CENTS = 100_000_00;

/**
 * Parse a user-typed dollar amount ("60", "60.5", "$1,234.56") into integer cents.
 * Rejects empty, non-numeric, zero, negative, and over-precise input.
 */
export function parseAmountToCents(input: string): number {
  let text = input.trim().replace(/^\$/, "");
  if (text === "") throw new ValidationError("Enter an amount.");
  // Commas are accepted only as thousands separators ("1,234.56"), never "12,3".
  if (text.includes(",")) {
    if (!/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(text)) {
      throw new ValidationError("Amount must be a positive number like 12.50 or 1,234.56.");
    }
    text = text.replace(/,/g, "");
  }
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) {
    throw new ValidationError(
      "Amount must be a positive number with at most two decimal places, like 12.50.",
    );
  }
  const dollars = Number(match[1]);
  const centsPart = (match[2] ?? "").padEnd(2, "0");
  const cents = dollars * 100 + Number(centsPart);
  if (!Number.isSafeInteger(cents)) throw new ValidationError("Amount is too large.");
  if (cents <= 0) throw new ValidationError("Amount must be greater than zero.");
  if (cents > MAX_AMOUNT_CENTS) {
    throw new ValidationError("Amount must be at most $100,000.00.");
  }
  return cents;
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

/** Format integer cents as "$12.34". */
export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}

/** Format a signed balance as "+$40.00" / "-$20.00" / "$0.00". */
export function formatSignedCents(cents: number): string {
  if (cents > 0) return `+${usd.format(cents / 100)}`;
  if (cents < 0) return `-${usd.format(-cents / 100)}`;
  return usd.format(0);
}
