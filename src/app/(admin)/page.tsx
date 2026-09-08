import type { Metadata } from "next";
import React from "react";
import { DatabaseExplorer } from "@/components/database/DatabaseExplorer";
import { AskYourData } from "@/components/nlp/AskYourData";
import { loadExplorerState } from "@/lib/data-explorer";

export const metadata: Metadata = {
  title: "Database Explorer | TailAdmin",
  description: "Explore and filter Postgres data from the home page.",
};


export default async function Home({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const state = await loadExplorerState(searchParams ?? {});

  return (
    <div className="space-y-6">
      <AskYourData />
      <DatabaseExplorer {...state} />
    </div>
  );
}
