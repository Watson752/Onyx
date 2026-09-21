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
      className="w-full min-h-11 rounded-full bg-terracotta px-7 py-3 text-sm font-medium tracking-wide text-bone hover:bg-terracotta-deep disabled:cursor-wait disabled:opacity-60 sm:w-auto"
    >
      {isPending ? (
        <span className="inline-flex items-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-bone border-t-transparent" />
          {pending}
        </span>
      ) : (
        idle
      )}
    </button>
  );
}
