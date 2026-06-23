/**
 * Message Query Tests
 * Tests for message database operations in lib/db/queries/chat.ts
 *
 * Note: These are unit tests focused on testing message query functions.
 * Integration tests with actual database would be in tests/integration/
 */

import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DBMessage } from "@/lib/db/drizzle-schema";

// Mock server-only before importing
vi.mock("server-only", () => ({}));

// Mock the entire database base module with factory function
vi.mock("@/lib/db/queries/base", () => {
  const mockDb = {
    insert: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  };
  return { db: mockDb, getDb: () => mockDb, isDbConfigured: true };
});

import { db as _db } from "@/lib/db/queries/base";
const db = _db!;
// Import after mocks are set up
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  getMessagesByChatId,
  saveMessages,
} from "@/lib/db/queries/chat";

// Get the mocked db functions
const mockDb = vi.mocked(db);

describe("Message Query Tests", () => {
  const mockChatId = randomUUID();
  const mockMessageId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("saveMessages - Message Creation", () => {
    it("should call database insert with correct message data", async () => {
      const mockMessage: DBMessage = {
        id: mockMessageId,
        chatId: mockChatId,
        role: "user",
        parts: [{ type: "text", text: "Hello, AI!" }],
        attachments: [],
        createdAt: new Date(),
        modelUsed: null,
        inputTokens: null,
        outputTokens: null,
        cost: null,
      };

      const mockValues = vi.fn().mockResolvedValue([mockMessage]);
      vi.mocked(mockDb.insert).mockReturnValue({ values: mockValues } as any);

      const result = await saveMessages({ messages: [mockMessage] });

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith([mockMessage]);
      expect(result).toBeDefined();
    });

    it("should save multiple messages in a batch operation", async () => {
      const mockMessages: DBMessage[] = [
        {
          id: randomUUID(),
          chatId: mockChatId,
          role: "user",
          parts: [{ type: "text", text: "First message" }],
          attachments: [],
          createdAt: new Date("2024-01-01T10:00:00Z"),
          modelUsed: null,
          inputTokens: null,
          outputTokens: null,
          cost: null,
        },
        {
          id: randomUUID(),
          chatId: mockChatId,
          role: "assistant",
          parts: [{ type: "text", text: "Response message" }],
          attachments: [],
          createdAt: new Date("2024-01-01T10:01:00Z"),
          modelUsed: "gemini-2.0-flash-exp",
          inputTokens: 100,
          outputTokens: 150,
          cost: "0.000025",
        },
      ];

      const mockValues = vi.fn().mockResolvedValue(mockMessages);
      vi.mocked(mockDb.insert).mockReturnValue({ values: mockValues } as any);

      await saveMessages({ messages: mockMessages });

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith(mockMessages);
    });

    it("should handle message with multimodal parts", async () => {
      const mockMessage: DBMessage = {
        id: mockMessageId,
        chatId: mockChatId,
        role: "user",
        parts: [
          { type: "text", text: "Look at this image" },
          {
            type: "image",
            inlineData: { mimeType: "image/png", data: "base64data" },
          },
        ],
        attachments: [],
        createdAt: new Date(),
        modelUsed: null,
        inputTokens: null,
        outputTokens: null,
        cost: null,
      };

      const mockValues = vi.fn().mockResolvedValue([mockMessage]);
      vi.mocked(mockDb.insert).mockReturnValue({ values: mockValues } as any);

      await saveMessages({ messages: [mockMessage] });

      expect(mockValues).toHaveBeenCalledWith([mockMessage]);
      const calledMessage = mockValues.mock.calls[0][0][0];
      expect(calledMessage.parts).toHaveLength(2);
    });

    it("should throw error when database insert fails", async () => {
      const mockMessage: DBMessage = {
        id: mockMessageId,
        chatId: mockChatId,
        role: "user",
        parts: [{ type: "text", text: "Test message" }],
        attachments: [],
        createdAt: new Date(),
        modelUsed: null,
        inputTokens: null,
        outputTokens: null,
        cost: null,
      };

      const mockValues = vi.fn().mockRejectedValue(new Error("Database error"));
      vi.mocked(mockDb.insert).mockReturnValue({ values: mockValues } as any);

      await expect(saveMessages({ messages: [mockMessage] })).rejects.toThrow();
    });
  });

  describe("getMessagesByChatId - Message List for Chat", () => {
    it("should retrieve all messages for a specific chat", async () => {
      const mockMessages: DBMessage[] = [
        {
          id: randomUUID(),
          chatId: mockChatId,
          role: "user",
          parts: [{ type: "text", text: "First message" }],
          attachments: [],
          createdAt: new Date("2024-01-01T10:00:00Z"),
          modelUsed: null,
          inputTokens: null,
          outputTokens: null,
          cost: null,
        },
        {
          id: randomUUID(),
          chatId: mockChatId,
          role: "assistant",
          parts: [{ type: "text", text: "Second message" }],
          attachments: [],
          createdAt: new Date("2024-01-01T10:01:00Z"),
          modelUsed: "gemini-2.0-flash-exp",
          inputTokens: 50,
          outputTokens: 75,
          cost: "0.000015",
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockMessages);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(mockDb.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getMessagesByChatId({ id: mockChatId });

      expect(mockDb.select).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0].parts).toEqual([
        { type: "text", text: "First message" },
      ]);
      expect(result[1].parts).toEqual([
        { type: "text", text: "Second message" },
      ]);
    });

    it("should return empty array when chat has no messages", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(mockDb.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getMessagesByChatId({ id: mockChatId });

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it("should throw error when database query fails", async () => {
      const mockOrderBy = vi
        .fn()
        .mockRejectedValue(new Error("Database error"));
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(mockDb.select).mockReturnValue({ from: mockFrom } as any);

      await expect(getMessagesByChatId({ id: mockChatId })).rejects.toThrow();
    });
  });

  describe("deleteMessagesByChatIdAfterTimestamp - Message Deletion", () => {
    it("should delete messages after specified timestamp", async () => {
      const timestamp = new Date("2024-01-01T12:00:00Z");
      const mockMessagesToDelete = [{ id: randomUUID() }, { id: randomUUID() }];

      // Mock select query
      const mockSelectWhere = vi.fn().mockResolvedValue(mockMessagesToDelete);
      const mockSelectFrom = vi
        .fn()
        .mockReturnValue({ where: mockSelectWhere });
      vi.mocked(mockDb.select).mockReturnValue({ from: mockSelectFrom } as any);

      // Mock delete operations
      const mockDeleteWhere = vi.fn().mockResolvedValue([]);
      vi.mocked(mockDb.delete).mockReturnValue({
        where: mockDeleteWhere,
      } as any);

      await deleteMessagesByChatIdAfterTimestamp({
        chatId: mockChatId,
        timestamp,
      });

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should not attempt deletion when no messages match criteria", async () => {
      const timestamp = new Date("2024-01-01T12:00:00Z");

      // Mock select query to return no messages
      const mockSelectWhere = vi.fn().mockResolvedValue([]);
      const mockSelectFrom = vi
        .fn()
        .mockReturnValue({ where: mockSelectWhere });
      vi.mocked(mockDb.select).mockReturnValue({ from: mockSelectFrom } as any);

      await deleteMessagesByChatIdAfterTimestamp({
        chatId: mockChatId,
        timestamp,
      });

      expect(mockDb.select).toHaveBeenCalled();
      // Delete should not be called when no messages found
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it("should handle deletion of multiple messages", async () => {
      const timestamp = new Date("2024-01-01T12:00:00Z");
      const mockMessagesToDelete = [
        { id: randomUUID() },
        { id: randomUUID() },
        { id: randomUUID() },
      ];

      const mockSelectWhere = vi.fn().mockResolvedValue(mockMessagesToDelete);
      const mockSelectFrom = vi
        .fn()
        .mockReturnValue({ where: mockSelectWhere });
      vi.mocked(mockDb.select).mockReturnValue({ from: mockSelectFrom } as any);

      const mockDeleteWhere = vi.fn().mockResolvedValue([]);
      vi.mocked(mockDb.delete).mockReturnValue({ where: mockDeleteWhere } as any);

      await deleteMessagesByChatIdAfterTimestamp({
        chatId: mockChatId,
        timestamp,
      });

      // Should delete votes and messages (2 delete operations)
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe("Message Pagination", () => {
    it("should handle retrieval of large message sets", async () => {
      const messageCount = 100;
      const mockMessages: DBMessage[] = Array.from(
        { length: messageCount },
        (_, i) => ({
          id: randomUUID(),
          chatId: mockChatId,
          role: i % 2 === 0 ? "user" : "assistant",
          parts: [{ type: "text", text: `Message ${i + 1}` }],
          attachments: [],
          createdAt: new Date(
            `2024-01-01T10:${String(i).padStart(2, "0")}:00Z`
          ),
          modelUsed: i % 2 === 1 ? "gemini-2.0-flash-exp" : null,
          inputTokens: i % 2 === 1 ? 50 : null,
          outputTokens: i % 2 === 1 ? 75 : null,
          cost: i % 2 === 1 ? "0.000015" : null,
        })
      );

      const mockOrderBy = vi.fn().mockResolvedValue(mockMessages);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(mockDb.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getMessagesByChatId({ id: mockChatId });

      expect(result).toHaveLength(messageCount);
      expect(result[0].parts).toEqual([{ type: "text", text: "Message 1" }]);
      expect(result[messageCount - 1].parts).toEqual([
        { type: "text", text: `Message ${messageCount}` },
      ]);
    });

    it("should maintain correct message order (ascending by creation time)", async () => {
      const mockMessages: DBMessage[] = [
        {
          id: randomUUID(),
          chatId: mockChatId,
          role: "user",
          parts: [{ type: "text", text: "First" }],
          attachments: [],
          createdAt: new Date("2024-01-01T10:00:00Z"),
          modelUsed: null,
          inputTokens: null,
          outputTokens: null,
          cost: null,
        },
        {
          id: randomUUID(),
          chatId: mockChatId,
          role: "assistant",
          parts: [{ type: "text", text: "Second" }],
          attachments: [],
          createdAt: new Date("2024-01-01T10:01:00Z"),
          modelUsed: "gemini-2.0-flash-exp",
          inputTokens: 50,
          outputTokens: 75,
          cost: "0.000015",
        },
        {
          id: randomUUID(),
          chatId: mockChatId,
          role: "user",
          parts: [{ type: "text", text: "Third" }],
          attachments: [],
          createdAt: new Date("2024-01-01T10:02:00Z"),
          modelUsed: null,
          inputTokens: null,
          outputTokens: null,
          cost: null,
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockMessages);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(mockDb.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getMessagesByChatId({ id: mockChatId });

      // Verify chronological order
      expect(result[0].parts).toEqual([{ type: "text", text: "First" }]);
      expect(result[1].parts).toEqual([{ type: "text", text: "Second" }]);
      expect(result[2].parts).toEqual([{ type: "text", text: "Third" }]);

      // Verify timestamps are in order
      expect(result[0].createdAt.getTime()).toBeLessThan(
        result[1].createdAt.getTime()
      );
      expect(result[1].createdAt.getTime()).toBeLessThan(
        result[2].createdAt.getTime()
      );
    });

    it("should handle single message edge case", async () => {
      const mockMessage: DBMessage = {
        id: mockMessageId,
        chatId: mockChatId,
        role: "user",
        parts: [{ type: "text", text: "Only message" }],
        attachments: [],
        createdAt: new Date(),
        modelUsed: null,
        inputTokens: null,
        outputTokens: null,
        cost: null,
      };

      const mockOrderBy = vi.fn().mockResolvedValue([mockMessage]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(mockDb.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getMessagesByChatId({ id: mockChatId });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockMessage);
    });
  });

  describe("getMessageById - Get Single Message", () => {
    it("should retrieve a specific message by ID", async () => {
      const mockMessage: DBMessage = {
        id: mockMessageId,
        chatId: mockChatId,
        role: "user",
        parts: [{ type: "text", text: "Specific message" }],
        attachments: [],
        createdAt: new Date(),
        modelUsed: null,
        inputTokens: null,
        outputTokens: null,
        cost: null,
      };

      const mockWhere = vi.fn().mockResolvedValue([mockMessage]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(mockDb.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getMessageById({ id: mockMessageId });

      expect(result).toEqual([mockMessage]);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when message not found", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(mockDb.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getMessageById({ id: mockMessageId });

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });
});
