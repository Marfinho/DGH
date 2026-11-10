import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LinkForm, InviteForm } from "./forms";

export default async function Login({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  if (await getUser()) redirect("/");
  const { fehler } = await searchParams;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Willkommen im Dorfplaner</h1>
      {fehler === "link" && <p className="rounded bg-red-50 p-2 text-sm text-red-700">Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.</p>}
      <LinkForm />
      <InviteForm />
      <p className="text-xs text-stone-500">Du hast noch keinen Zugang? Frag die Organisatoren nach einem Einladungscode.</p>
    </div>
  );
}
