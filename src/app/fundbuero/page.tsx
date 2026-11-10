import { requireUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { BoardView } from "@/components/board";

export default async function Fundbuero({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const me = await requireUser();
  const { fehler } = await searchParams;
  return (<><PageTitle>Fundbüro</PageTitle><p className="mb-4 text-stone-600">Etwas gefunden oder verloren? Hier landet es, bis es wieder beim Besitzer ist.</p>
    <BoardView me={me} categories={["FUNDBUERO"]} fehler={fehler} base="/fundbuero" /></>);
}
