// Shared shape of the state returned by server actions to useActionState.
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  /** Changes on every successful submit so forms can reset themselves. */
  submittedAt?: number;
};

export const idleState: FormState = { status: "idle" };
