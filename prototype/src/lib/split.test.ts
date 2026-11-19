import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import { formatSignedCents, parseAmountToCents } from "./money";
import { splitEqually } from "./split";
import { computeBalances } from "./balances";

describe("splitEqually", () => {
  it("splits $60 three ways into $20 each", () => {
    expect(splitEqually(6000, [1, 2, 3])).toEqual([
      { memberId: 1, shareCents: 2000 },
      { memberId: 2, shareCents: 2000 },
      { memberId: 3, shareCents: 2000 },
    ]);
  });

  it("allocates a $10 three-way split to the cent: 3.34, 3.33, 3.33", () => {
    const shares = splitEqually(1000, [1, 2, 3]);
    expect(shares.map((s) => s.shareCents)).toEqual([334, 333, 333]);
    expect(shares.reduce((sum, s) => sum + s.shareCents, 0)).toBe(1000);
  });

  it("distributes the remainder deterministically regardless of selection order", () => {
    expect(splitEqually(1000, [3, 1, 2])).toEqual(splitEqually(1000, [1, 2, 3]));
    expect(splitEqually(1000, [2, 3, 1])[0]).toEqual({ memberId: 1, shareCents: 334 });
  });

  it("ignores duplicate participants", () => {
    expect(splitEqually(1000, [1, 1, 2])).toEqual([
      { memberId: 1, shareCents: 500 },
      { memberId: 2, shareCents: 500 },
    ]);
  });

  it("gives some participants $0.00 when the amount is smaller than the group", () => {
    expect(splitEqually(1, [1, 2, 3]).map((s) => s.shareCents)).toEqual([1, 0, 0]);
  });

  it("always sums exactly to the amount", () => {
    for (let amount = 1; amount <= 500; amount++) {
      for (let n = 1; n <= 7; n++) {
        const ids = Array.from({ length: n }, (_, i) => i + 1);
        const total = splitEqually(amount, ids).reduce((sum, s) => sum + s.shareCents, 0);
        expect(total).toBe(amount);
      }
    }
  });

  it("rejects an empty participant list and non-positive amounts", () => {
    expect(() => splitEqually(1000, [])).toThrow(ValidationError);
    expect(() => splitEqually(0, [1])).toThrow(ValidationError);
    expect(() => splitEqually(-5, [1])).toThrow(ValidationError);
    expect(() => splitEqually(10.5, [1])).toThrow(ValidationError);
  });
});

describe("parseAmountToCents", () => {
  it("parses whole dollars, cents, and formatted input", () => {
    expect(parseAmountToCents("60")).toBe(6000);
    expect(parseAmountToCents("60.5")).toBe(6050);
    expect(parseAmountToCents(" $1,234.56 ")).toBe(123456);
    expect(parseAmountToCents("0.01")).toBe(1);
    expect(parseAmountToCents("100000")).toBe(10_000_000);
  });

  it("rejects invalid amounts with a readable message", () => {
    for (const bad of ["", "   ", "abc", "-5", "0", "0.00", "12.345", "1e3", "100000.01", "12,3"]) {
      expect(() => parseAmountToCents(bad), bad).toThrow(ValidationError);
    }
    expect(() => parseAmountToCents("-5")).toThrow(/positive number/);
    expect(() => parseAmountToCents("0")).toThrow(/greater than zero/);
  });
});

describe("computeBalances", () => {
  const members = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
    { id: 3, name: "Charlie" },
  ];

  it("gives Alice +40 and Bob and Charlie -20 for a $60 expense Alice paid", () => {
    const expense = { amountCents: 6000, payerId: 1, shares: splitEqually(6000, [1, 2, 3]) };
    const balances = computeBalances(members, [expense]);
    expect(balances.map((b) => [b.name, b.netCents])).toEqual([
      ["Alice", 4000],
      ["Bob", -2000],
      ["Charlie", -2000],
    ]);
    expect(formatSignedCents(4000)).toBe("+$40.00");
    expect(formatSignedCents(-2000)).toBe("-$20.00");
  });

  it("sums to zero across several expenses with odd remainders", () => {
    const expenses = [
      { amountCents: 6000, payerId: 1, shares: splitEqually(6000, [1, 2, 3]) },
      { amountCents: 1000, payerId: 2, shares: splitEqually(1000, [1, 2, 3]) },
      { amountCents: 777, payerId: 3, shares: splitEqually(777, [2, 3]) },
    ];
    const balances = computeBalances(members, expenses);
    expect(balances.reduce((sum, b) => sum + b.netCents, 0)).toBe(0);
    expect(balances.find((b) => b.name === "Alice")?.netCents).toBe(6000 - 2000 - 334);
  });

  it("returns zero balances for a group with no expenses", () => {
    expect(computeBalances(members, []).every((b) => b.netCents === 0)).toBe(true);
  });
});
