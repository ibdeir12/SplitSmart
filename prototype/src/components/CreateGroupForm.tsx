"use client";

import { useActionState } from "react";
import { createGroupAction } from "@/lib/actions";
import { idleState } from "@/lib/form-state";
import { SubmitButton } from "./SubmitButton";
import { FormMessage, inputClass, labelClass } from "./ui";

export function CreateGroupForm() {
  const [state, action] = useActionState(createGroupAction, idleState);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="group-name" className={labelClass}>
          Group name
        </label>
        <input
          id="group-name"
          name="name"
          required
          maxLength={60}
          placeholder="Apartment 4B, Spring break trip..."
          className={inputClass}
        />
      </div>
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Creating...">Create group</SubmitButton>
    </form>
  );
}
