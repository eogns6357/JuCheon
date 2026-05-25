import { redirect } from "next/navigation";

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string; name?: string }>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (sp.ticker) q.set("ticker", sp.ticker);
  if (sp.name) q.set("name", sp.name);
  const query = q.toString();
  redirect(query ? `/quote?${query}` : "/quote");
}
