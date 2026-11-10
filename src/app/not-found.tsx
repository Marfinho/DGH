import Link from "next/link";
import { PageTitle } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="py-6">
      <PageTitle>Seite nicht gefunden</PageTitle>
      <p className="mb-4 text-lg">Diese Seite gibt es nicht – oder du darfst sie nicht sehen.</p>
      <Link href="/" className="btn">Zur Startseite</Link>
    </div>
  );
}
