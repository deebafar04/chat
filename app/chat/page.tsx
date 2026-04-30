import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";

// Default model constant
const DEFAULT_CHAT_MODEL = "gemini-2.5-flash";

import { getCurrentUser, isAuthRequired } from "@/lib/auth/server";
import { generateUUID } from "@/lib/utils";

// Force dynamic rendering for authenticated pages
export const dynamic = "force-dynamic";

export default async function ChatPage() {
	const user = await getCurrentUser();

	// Redirect unauthenticated users to login when this host requires auth.
	if (!user && (await isAuthRequired())) {
		redirect("/login?returnTo=/chat");
	}

	const id = generateUUID();

	const cookieStore = await cookies();
	const modelIdFromCookie = cookieStore.get("chat-model");

	// Get default model from cookie or use hardcoded default
	const defaultModel = modelIdFromCookie?.value || DEFAULT_CHAT_MODEL;

	// Model selection completed

	return (
		<>
			<Chat
				autoResume={false}
				id={id}
				initialChatModel={defaultModel}
				initialMessages={[]}
				initialVisibilityType="private"
				isReadonly={false}
				key={id}
			/>
			<DataStreamHandler />
		</>
	);
}
