import { redeemToken } from "../actions";

// Bewusst erst per Klick einlösen: Mail-Scanner rufen Links oft vorab auf und würden den Token sonst verbrauchen.
export default async function TokenPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return (
    <form action={redeemToken} className="card mx-auto max-w-md space-y-3">
      <h1 className="text-xl font-bold">Anmeldung bestätigen</h1>
      <input type="hidden" name="t" value={t ?? ""} />
      <button className="btn">Jetzt anmelden</button>
    </form>
  );
}
