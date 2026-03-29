import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";

// Default model constant
const DEFAULT_CHAT_MODEL = "gemini-2.5-flash";

import { getCurrentUser } from "@/lib/auth/server";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import {
  ActivityCategory,
  logUserActivity,
  UserActivityType,
} from "@/lib/logging/activity-logger";
import { convertToUIMessages } from "@/lib/utils";

// Force dynamic rendering for authenticated pages
export const dynamic = "force-dynamic";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;

  // Reject IDs that look like file paths (e.g., stackframe.js, *.map, etc.)
  if (id.includes(".") || id.includes("/")) {
    notFound();
  }

  const chat = await getChatById({ id });

  if (!chat) {
    notFound();
  }

  const user = await getCurrentUser();

  // Check if user can access this chat
  if (chat.visibility === "private") {
    if (!user) {
      return notFound();
    }

    if (user.id !== chat.user_id) {
      return notFound();
    }
  }

  // Log chat view activity (async, non-blocking)
  if (user) {
    logUserActivity({
      user_id: user.id,
      activity_type: UserActivityType.CHAT_VIEW,
      activity_category: ActivityCategory.CHAT,
      resource_id: id,
      resource_type: "chat",
      request_path: `/chat/${id}`,
      request_method: "GET",
      success: true,
    }).catch((err) => {
      console.error("Failed to log chat view:", err);
    });
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  const uiMessages = convertToUIMessages(messagesFromDb);

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");

  // Determine if chat should be readonly based on user ownership
  const isReadonly = !user || user.id !== chat.user_id;

  if (!chatModelFromCookie) {
    return (
      <>
        <Chat
          autoResume={true}
          id={chat.id}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialLastContext={(chat.lastContext as any) ?? undefined}
          initialMessages={uiMessages}
          initialVisibilityType={chat.visibility as any}
          isReadonly={isReadonly}
        />
        <DataStreamHandler />
      </>
    );
  }

  return (
    <>
      <Chat
        autoResume={true}
        id={chat.id}
        initialChatModel={chatModelFromCookie.value}
        initialLastContext={(chat.lastContext as any) ?? undefined}
        initialMessages={uiMessages}
        initialVisibilityType={chat.visibility as any}
        isReadonly={isReadonly}
      />
      <DataStreamHandler />
    </>
  );
}
