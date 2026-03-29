/**
 * Main entry point for the AI chat agent system
 */

// Simple chat agent resolver
export { ChatAgentResolver } from "./chat-agent-resolver";
export * from "./core/errors";
// Core types and errors
export * from "./core/types";

// Google agents (for direct usage if needed)
export { GoogleChatAgent } from "./providers/google/chat-agent";

// Default model constant
export const DEFAULT_CHAT_MODEL = "gemini-2.5-flash";
