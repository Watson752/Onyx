"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  idle,
  pending,
}: {
  idle: string;
  pending: string;
}) {
  const { pending: isPending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={isPending}
      className="rounded bg-zinc-950 px-4 py-2 font-medium text-white disabled:cursor-wait disabled:opacity-60"
    >
      {isPending ? (
        <span className="inline-flex items-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          {pending}
        </span>
      ) : (
        idle
      )}
    </button>
  );
}
