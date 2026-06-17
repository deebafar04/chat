import { auth } from "@/lib/auth/instance";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";

const unavailable = () => NextResponse.json({ error: "Auth not configured" }, { status: 503 });
const handler = auth ? toNextJsHandler(auth) : { GET: unavailable, POST: unavailable };
export const { GET, POST } = handler;
