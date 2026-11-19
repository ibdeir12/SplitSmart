"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { isUserError } from "./errors";
import type { FormState } from "./form-state";
import { addMember, createGroup, recordExpense } from "./services";

// Server actions: the only way the browser changes data. Prisma never runs in
// the browser. Each action returns a small state object for useActionState.

function failure(e: unknown): FormState {
  if (isUserError(e)) return { status: "error", message: e.message };
  console.error(e);
  return { status: "error", message: "Something went wrong while saving. Please try again." };
}

export async function createGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let groupId: number;
  try {
    const group = await createGroup(prisma, String(formData.get("name") ?? ""));
    groupId = group.id;
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/");
  redirect(`/groups/${groupId}`);
}

export async function addMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const groupId = formData.get("groupId");
  try {
    const member = await addMember(prisma, groupId, String(formData.get("name") ?? ""));
    revalidatePath(`/groups/${groupId}`);
    revalidatePath("/");
    return { status: "success", message: `Added ${member.name}.`, submittedAt: Date.now() };
  } catch (e) {
    return failure(e);
  }
}

export async function recordExpenseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const groupId = formData.get("groupId");
  try {
    const expense = await recordExpense(prisma, {
      groupId,
      description: String(formData.get("description") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      payerId: formData.get("payerId"),
      participantIds: formData.getAll("participantIds"),
    });
    revalidatePath(`/groups/${groupId}`);
    revalidatePath("/");
    return {
      status: "success",
      message: `Recorded "${expense.description}".`,
      submittedAt: Date.now(),
    };
  } catch (e) {
    return failure(e);
  }
}
