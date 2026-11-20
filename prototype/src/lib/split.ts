import { ValidationError } from "./errors";

export type Share = { memberId: number; shareCents: number };

/**
 * Split an amount equally among participants, in integer cents.
 *
 * Participants are deduplicated and ordered by ascending member id so the
 * result does not depend on selection order. Each participant gets
 * floor(amount / n); the leftover cents (always fewer than n) go one each to
 * the participants with the lowest ids. The shares always sum to amountCents.
 */
export function splitEqually(amountCents: number, participantIds: number[]): Share[] {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new ValidationError("Amount must be a positive whole number of cents.");
  }
  const ids = [...new Set(participantIds)].sort((a, b) => a - b);
  if (ids.length === 0) throw new ValidationError("Select at least one participant.");

  const base = Math.floor(amountCents / ids.length);
  const leftover = amountCents - base * ids.length;
  return ids.map((memberId, index) => ({
    memberId,
    shareCents: base + (index < leftover ? 1 : 0),
  }));
}
