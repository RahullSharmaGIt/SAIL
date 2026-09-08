import { answerExpenditureQuestion } from "@/lib/nlp-query";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { question?: unknown };
    if (typeof body.question !== "string") return Response.json({ error: "Question must be a string." }, { status: 400 });
    return Response.json(await answerExpenditureQuestion(body.question));
  } catch (error) {
    // Keep provider, database, SQL, and credential details on the server.
    return Response.json({ error: error instanceof Error ? error.message : "Unable to answer that question." }, { status: 400 });
  }
}
