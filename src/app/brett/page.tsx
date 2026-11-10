import { requireUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { BoardView } from "@/components/board";

export default async function Brett({ searchParams }: { searchParams: Promise<{ kat?: string; fehler?: string }> }) {
  const me = await requireUser();
  const { kat, fehler } = await searchParams;
  return (<><PageTitle>Schwarzes Brett</PageTitle><p className="mb-4 text-stone-600">Suchen, anbieten, mitfahren, helfen – von Nachbar zu Nachbar.</p>
    <BoardView me={me} categories={["ALLGEMEIN", "MITFAHREN", "LEIHEN", "HILFE"]} active={kat} fehler={fehler} base="/brett" /></>);
}
