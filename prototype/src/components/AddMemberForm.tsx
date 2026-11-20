"use client";

import { useActionState, useEffect, useRef } from "react";
import { addMemberAction } from "@/lib/actions";
import { idleState } from "@/lib/form-state";
import { SubmitButton } from "./SubmitButton";
import { FormMessage, inputClass } from "./ui";

export function AddMemberForm({ groupId }: { groupId: number }) {
  const [state, action] = useActionState(addMemberAction, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.submittedAt, state.status]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="flex gap-2">
        <input
          name="name"
          required
          maxLength={60}
          placeholder="Member name"
          aria-label="Member name"
          className={inputClass}
        />
        <SubmitButton pendingText="Adding...">Add</SubmitButton>
      </div>
      <FormMessage status={state.status} message={state.message} />
    </form>
  );
}
