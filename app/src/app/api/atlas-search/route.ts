import { NextResponse } from "next/server";
import { searchAtlas } from "@/lib/atlas-search";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ results: searchAtlas(query) });
}
