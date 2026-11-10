"use client";
import { useActionState } from "react";
import { createInvite } from "./actions";

export function InviteButton({ id }: { id: number }) {
  const [s, a, pending] = useActionState(createInvite, {} as { code?: string });
  return (
    <form action={a} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button className="btn-light" disabled={pending}>Einladungscode</button>
      {s.code && <span className="rounded bg-amber-50 px-2 py-1 font-mono text-sm" title="7 Tage gültig, einmalig">{s.code}</span>}
    </form>
  );
}
