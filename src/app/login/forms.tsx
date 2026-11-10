"use client";
import { useActionState } from "react";
import { requestLink, redeemInvite, type LoginState } from "./actions";

function Msg({ s }: { s: LoginState }) {
  if (!s) return null;
  return <p className={`text-sm ${s.error ? "text-red-700" : "text-green-800"}`}>{s.error ?? s.info}</p>;
}

export function LinkForm() {
  const [s, a, pending] = useActionState(requestLink, null);
  return (
    <form action={a} className="card space-y-3">
      <h2 className="font-semibold">Anmelden per E-Mail-Link</h2>
      <div><label className="label">E-Mail-Adresse</label><input name="email" type="email" required autoComplete="email" className="input" /></div>
      <button className="btn" disabled={pending}>Link senden</button><Msg s={s} />
    </form>
  );
}
export function InviteForm() {
  const [s, a, pending] = useActionState(redeemInvite, null);
  return (
    <form action={a} className="card space-y-3">
      <h2 className="font-semibold">Ich habe einen Einladungscode</h2>
      <div><label className="label">Code (z. B. ABCD-EFGH)</label><input name="code" required autoComplete="off" className="input uppercase tracking-widest" /></div>
      <button className="btn" disabled={pending}>Mit Code anmelden</button><Msg s={s} />
    </form>
  );
}
