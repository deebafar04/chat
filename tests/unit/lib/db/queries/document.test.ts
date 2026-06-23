/**
 * Unit tests for document query functions
 * Tests document creation, versioning, retrieval, and deletion
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactKind } from "@/components/artifact";
import { ChatSDKError } from "@/lib/errors";

// Mock server-only module to prevent client component error
vi.mock("server-only", () => ({}));

// Mock the database module
vi.mock("@/lib/db/queries/base", () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  };
  return { db: mockDb, getDb: () => mockDb, isDbConfigured: true };
});

import { db as _db } from "@/lib/db/queries/base";
const db = _db!;
// Import after mocking
import {
  deleteDocumentsByIdAfterTimestamp,
  getDocumentById,
  getDocumentByIdAndVersion,
  getDocumentsById,
  getDocumentVersions,
  saveDocument,
} from "@/lib/db/queries/document";

describe("Document Query Tests", () => {
  const mockUserId = "123e4567-e89b-12d3-a456-426614174000";
  const mockChatId = "123e4567-e89b-12d3-a456-426614174001";
  const mockDocumentId = "doc-123e4567-e89b-12d3-a456-426614174002";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("saveDocument - Document Creation (Version 1)", () => {
    it("should create a new document with version 1", async () => {
      const mockDocument = {
        id: mockDocumentId,
        title: "Test Document",
        kind: "text" as ArtifactKind,
        content: "This is test content",
        user_id: mockUserId,
        chat_id: mockChatId,
        version_number: 1,
        metadata: {},
        createdAt: new Date(),
        parent_version_id: null,
      };

      // Mock the max version query (returns null for first version)
      const _mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([{ maxVersion: null }]);

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere,
        }),
      });

      // Mock the insert query
      const _mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([mockDocument]);

      (db.insert as any).mockReturnValue({
        values: mockValues.mockReturnValue({
          returning: mockReturning,
        }),
      });

      const result = await saveDocument({
        id: mockDocumentId,
        title: "Test Document",
        kind: "text",
        content: "This is test content",
        userId: mockUserId,
        chatId: mockChatId,
      });

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0].version_number).toBe(1);
      expect(result[0].title).toBe("Test Document");
    });

    it("should create document with metadata", async () => {
      const mockMetadata = { tags: ["test", "document"], priority: "high" };
      const mockDocument = {
        id: mockDocumentId,
        title: "Test Document with Metadata",
        kind: "text" as ArtifactKind,
        content: "Content",
        user_id: mockUserId,
        chat_id: mockChatId,
        version_number: 1,
        metadata: mockMetadata,
        createdAt: new Date(),
        parent_version_id: null,
      };

      // Mock the max version query
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([{ maxVersion: null }]);

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere,
        }),
      });

      // Mock the insert query
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([mockDocument]);

      (db.insert as any).mockReturnValue({
        values: mockValues.mockReturnValue({
          returning: mockReturning,
        }),
      });

      const result = await saveDocument({
        id: mockDocumentId,
        title: "Test Document with Metadata",
        kind: "text",
        content: "Content",
        userId: mockUserId,
        chatId: mockChatId,
        metadata: mockMetadata,
      });

      expect(result[0].metadata).toEqual(mockMetadata);
    });

    it("should handle database errors during creation", async () => {
      // Mock the max version query
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([{ maxVersion: null }]);

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere,
        }),
      });

      // Mock insert to throw error
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi
        .fn()
        .mockRejectedValue(new Error("Database error"));

      (db.insert as any).mockReturnValue({
        values: mockValues.mockReturnValue({
          returning: mockReturning,
        }),
      });

      await expect(
        saveDocument({
          id: mockDocumentId,
          title: "Test Document",
          kind: "text",
          content: "Content",
          userId: mockUserId,
          chatId: mockChatId,
        })
      ).rejects.toThrow(ChatSDKError);
    });
  });

  describe("saveDocument - Document Update (New Version)", () => {
    it("should create version 2 when updating existing document", async () => {
      const mockDocument = {
        id: mockDocumentId,
        title: "Updated Document",
        kind: "text" as ArtifactKind,
        content: "Updated content",
        user_id: mockUserId,
        chat_id: mockChatId,
        version_number: 2,
        metadata: {},
        createdAt: new Date(),
        parent_version_id: null,
      };

      // Mock the max version query (returns 1 for existing document)
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([{ maxVersion: 1 }]);

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere,
        }),
      });

      // Mock the insert query
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([mockDocument]);

      (db.insert as any).mockReturnValue({
        values: mockValues.mockReturnValue({
          returning: mockReturning,
        }),
      });

      const result = await saveDocument({
        id: mockDocumentId,
        title: "Updated Document",
        kind: "text",
        content: "Updated content",
        userId: mockUserId,
        chatId: mockChatId,
      });

      expect(result[0].version_number).toBe(2);
      expect(result[0].title).toBe("Updated Document");
    });

    it("should create version 3 when document already has 2 versions", async () => {
      const mockDocument = {
        id: mockDocumentId,
        title: "Third Version",
        kind: "text" as ArtifactKind,
        content: "Third version content",
        user_id: mockUserId,
        chat_id: mockChatId,
        version_number: 3,
        metadata: {},
        createdAt: new Date(),
        parent_version_id: null,
      };

      // Mock the max version query (returns 2 for existing document)
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([{ maxVersion: 2 }]);

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere,
        }),
      });

      // Mock the insert query
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([mockDocument]);

      (db.insert as any).mockReturnValue({
        values: mockValues.mockReturnValue({
          returning: mockReturning,
        }),
      });

      const result = await saveDocument({
        id: mockDocumentId,
        title: "Third Version",
        kind: "text",
        content: "Third version content",
        userId: mockUserId,
        chatId: mockChatId,
      });

      expect(result[0].version_number).toBe(3);
    });

    it("should track parent version when updating", async () => {
      const parentVersionId = "parent-version-123";
      const mockDocument = {
        id: mockDocumentId,
        title: "Document with Parent",
        kind: "text" as ArtifactKind,
        content: "Content",
        user_id: mockUserId,
        chat_id: mockChatId,
        version_number: 2,
        metadata: {},
        createdAt: new Date(),
        parent_version_id: parentVersionId,
      };

      // Mock the max version query
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([{ maxVersion: 1 }]);

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere,
        }),
      });

      // Mock the insert query
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([mockDocument]);

      (db.insert as any).mockReturnValue({
        values: mockValues.mockReturnValue({
          returning: mockReturning,
        }),
      });

      const result = await saveDocument({
        id: mockDocumentId,
        title: "Document with Parent",
        kind: "text",
        content: "Content",
        userId: mockUserId,
        chatId: mockChatId,
        parentVersionId,
      });

      expect(result[0].parent_version_id).toBe(parentVersionId);
    });
  });

  describe("getDocumentByIdAndVersion - Version Retrieval", () => {
    it("should retrieve a specific version of a document", async () => {
      const mockDocument = {
        id: mockDocumentId,
        title: "Version 1 Document",
        kind: "text" as ArtifactKind,
        content: "Version 1 content",
        user_id: mockUserId,
        chat_id: mockChatId,
        version_number: 1,
        metadata: {},
        createdAt: new Date(),
        parent_version_id: null,
      };

      // Mock the select query
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([mockDocument]);

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere,
        }),
      });

      const result = await getDocumentByIdAndVersion({
        id: mockDocumentId,
        version: 1,
      });

      expect(result).toBeDefined();
      expect(result.version_number).toBe(1);
      expect(result.title).toBe("Version 1 Document");
    });

    it("should retrieve version 2 when requested", async () => {
      const mockDocument = {
        id: mockDocumentId,
        title: "Version 2 Document",
        kind: "text" as ArtifactKind,
        content: "Version 2 content",
        user_id: mockUserId,
        chat_id: mockChatId,
        version_number: 2,
        metadata: {},
        createdAt: new Date(),
        parent_version_id: null,
      };

      // Mock the select query
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([mockDocument]);

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere,
        }),
      });

      const result = await getDocumentByIdAndVersion({
        id: mockDocumentId,
        version: 2,
      });

      expect(result.version_number).toBe(2);
    });

    it("should handle errors when retrieving specific version", async () => {
      // Mock select to throw error
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockRejectedValue(new Error("Database error"));

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere,
        }),
      });

      await expect(
        getDocumentByIdAndVersion({ id: mockDocumentId, version: 1 })
      ).rejects.toThrow(ChatSDKError);
    });
  });

  describe("getDocumentVersions - Version List for Document", () => {
    it("should retrieve all versions of a document ordered by version number", async () => {
      const mockDocuments = [
        {
          id: mockDocumentId,
          title: "Document",
          kind: "text" as ArtifactKind,
          content: "Version 3",
          user_id: mockUserId,
          chat_id: mockChatId,
          version_number: 3,
          metadata: {},
          createdAt: new Date("2024-01-03"),
          parent_version_id: null,
        },
        {
          id: mockDocumentId,
          title: "Document",
          kind: "text" as ArtifactKind,
          content: "Version 2",
          user_id: mockUserId,
          chat_id: mockChatId,
          version_number: 2,
          metadata: {},
          createdAt: new Date("2024-01-02"),
          parent_version_id: null,
        },
        {
          id: mockDocumentId,
          title: "Document",
          kind: "text" as ArtifactKind,
          content: "Version 1",
          user_id: mockUserId,
          chat_id: mockChatId,
          version_number: 1,
          metadata: {},
          createdAt: new Date("2024-01-01"),
          parent_version_id: null,
        },
      ];

      // Mock the select query
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockResolvedValue(mockDocuments);

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            orderBy: mockOrderBy,
          }),
        }),
      });

      const result = await getDocumentVersions({ id: mockDocumentId });

      expect(result).toHaveLength(3);
      expect(result[0].version_number).toBe(3); // Descending order
      expect(result[1].version_number).toBe(2);
      expect(result[2].version_number).toBe(1);
    });

    it("should return empty array for document with no versions", async () => {
      // Mock the select query to return empty array
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockResolvedValue([]);

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            orderBy: mockOrderBy,
          }),
        }),
      });

      const result = await getDocumentVersions({ id: "non-existent-id" });

      expect(result).toHaveLength(0);
    });

    it("should handle database errors when retrieving versions", async () => {
      // Mock select to throw error
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi
        .fn()
        .mockRejectedValue(new Error("Database error"));

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            orderBy: mockOrderBy,
          }),
        }),
      });

      await expect(getDocumentVersions({ id: mockDocumentId })).rejects.toThrow(
        ChatSDKError
      );
    });
  });

  describe("getDocumentById - Latest Version Retrieval", () => {
    it("should retrieve the latest version of a document", async () => {
      const mockDocument = {
        id: mockDocumentId,
        title: "Latest Document",
        kind: "text" as ArtifactKind,
        content: "Latest content",
        user_id: mockUserId,
        chat_id: mockChatId,
        version_number: 3,
        metadata: {},
        createdAt: new Date(),
        parent_version_id: null,
      };

      // Mock the select query
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockResolvedValue([mockDocument]);

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            orderBy: mockOrderBy,
          }),
        }),
      });

      const result = await getDocumentById({ id: mockDocumentId });

      expect(result).toBeDefined();
      expect(result.version_number).toBe(3);
      expect(result.title).toBe("Latest Document");
    });

    it("should return undefined when document does not exist", async () => {
      // Mock the select query to return empty array
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockResolvedValue([]);

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            orderBy: mockOrderBy,
          }),
        }),
      });

      const result = await getDocumentById({ id: "non-existent-id" });

      expect(result).toBeUndefined();
    });

    it("should handle database errors when retrieving latest version", async () => {
      // Mock select to throw error
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi
        .fn()
        .mockRejectedValue(new Error("Database error"));

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            orderBy: mockOrderBy,
          }),
        }),
      });

      await expect(getDocumentById({ id: mockDocumentId })).rejects.toThrow(
        ChatSDKError
      );
    });
  });

  describe("deleteDocumentsByIdAfterTimestamp - Document Deletion", () => {
    it("should delete documents created after a specific timestamp", async () => {
      const timestamp = new Date("2024-01-02");
      const mockDeletedDocuments = [
        {
          id: mockDocumentId,
          title: "Deleted Document",
          kind: "text" as ArtifactKind,
          content: "Content",
          user_id: mockUserId,
          chat_id: mockChatId,
          version_number: 3,
          metadata: {},
          createdAt: new Date("2024-01-03"),
          parent_version_id: null,
        },
      ];

      // Mock the suggestion delete
      const _mockSuggestionDelete = vi.fn().mockReturnThis();
      const mockSuggestionWhere = vi.fn().mockResolvedValue(undefined);

      (db.delete as any).mockReturnValueOnce({
        where: mockSuggestionWhere,
      });

      // Mock the document delete
      const _mockDocumentDelete = vi.fn().mockReturnThis();
      const mockDocumentWhere = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue(mockDeletedDocuments);

      (db.delete as any).mockReturnValueOnce({
        where: mockDocumentWhere.mockReturnValue({
          returning: mockReturning,
        }),
      });

      const result = await deleteDocumentsByIdAfterTimestamp({
        id: mockDocumentId,
        timestamp,
      });

      expect(result).toHaveLength(1);
      expect(result[0].version_number).toBe(3);
    });

    it("should delete related suggestions before deleting documents", async () => {
      const timestamp = new Date("2024-01-02");

      // Mock the suggestion delete
      const mockSuggestionWhere = vi.fn().mockResolvedValue(undefined);

      (db.delete as any).mockReturnValueOnce({
        where: mockSuggestionWhere,
      });

      // Mock the document delete
      const mockDocumentWhere = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([]);

      (db.delete as any).mockReturnValueOnce({
        where: mockDocumentWhere.mockReturnValue({
          returning: mockReturning,
        }),
      });

      await deleteDocumentsByIdAfterTimestamp({
        id: mockDocumentId,
        timestamp,
      });

      // Verify suggestions were deleted first
      expect(db.delete).toHaveBeenCalledTimes(2);
    });

    it("should return empty array when no documents match timestamp criteria", async () => {
      const timestamp = new Date("2024-01-01");

      // Mock the suggestion delete
      const mockSuggestionWhere = vi.fn().mockResolvedValue(undefined);

      (db.delete as any).mockReturnValueOnce({
        where: mockSuggestionWhere,
      });

      // Mock the document delete
      const mockDocumentWhere = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([]);

      (db.delete as any).mockReturnValueOnce({
        where: mockDocumentWhere.mockReturnValue({
          returning: mockReturning,
        }),
      });

      const result = await deleteDocumentsByIdAfterTimestamp({
        id: mockDocumentId,
        timestamp,
      });

      expect(result).toHaveLength(0);
    });

    it("should handle database errors during deletion", async () => {
      const timestamp = new Date("2024-01-02");

      // Mock the suggestion delete
      const mockSuggestionWhere = vi.fn().mockResolvedValue(undefined);

      (db.delete as any).mockReturnValueOnce({
        where: mockSuggestionWhere,
      });

      // Mock document delete to throw error
      const mockDocumentWhere = vi.fn().mockReturnThis();
      const mockReturning = vi
        .fn()
        .mockRejectedValue(new Error("Database error"));

      (db.delete as any).mockReturnValueOnce({
        where: mockDocumentWhere.mockReturnValue({
          returning: mockReturning,
        }),
      });

      await expect(
        deleteDocumentsByIdAfterTimestamp({ id: mockDocumentId, timestamp })
      ).rejects.toThrow(ChatSDKError);
    });
  });

  describe("getDocumentsById - Version Comparison Query", () => {
    it("should retrieve all versions for comparison ordered by creation time", async () => {
      const mockDocuments = [
        {
          id: mockDocumentId,
          title: "Document",
          kind: "text" as ArtifactKind,
          content: "Version 1 content",
          user_id: mockUserId,
          chat_id: mockChatId,
          version_number: 1,
          metadata: {},
          createdAt: new Date("2024-01-01"),
          parent_version_id: null,
        },
        {
          id: mockDocumentId,
          title: "Document",
          kind: "text" as ArtifactKind,
          content: "Version 2 content",
          user_id: mockUserId,
          chat_id: mockChatId,
          version_number: 2,
          metadata: {},
          createdAt: new Date("2024-01-02"),
          parent_version_id: null,
        },
        {
          id: mockDocumentId,
          title: "Document",
          kind: "text" as ArtifactKind,
          content: "Version 3 content",
          user_id: mockUserId,
          chat_id: mockChatId,
          version_number: 3,
          metadata: {},
          createdAt: new Date("2024-01-03"),
          parent_version_id: null,
        },
      ];

      // Mock the select query
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockResolvedValue(mockDocuments);

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            orderBy: mockOrderBy,
          }),
        }),
      });

      const result = await getDocumentsById({ id: mockDocumentId });

      expect(result).toHaveLength(3);
      // Should be ordered by creation time (ascending)
      expect(result[0].version_number).toBe(1);
      expect(result[1].version_number).toBe(2);
      expect(result[2].version_number).toBe(3);
    });

    it("should allow comparison between any two versions", async () => {
      const mockDocuments = [
        {
          id: mockDocumentId,
          title: "Document",
          kind: "text" as ArtifactKind,
          content: "Original content",
          user_id: mockUserId,
          chat_id: mockChatId,
          version_number: 1,
          metadata: {},
          createdAt: new Date("2024-01-01"),
          parent_version_id: null,
        },
        {
          id: mockDocumentId,
          title: "Document",
          kind: "text" as ArtifactKind,
          content: "Updated content with changes",
          user_id: mockUserId,
          chat_id: mockChatId,
          version_number: 2,
          metadata: {},
          createdAt: new Date("2024-01-02"),
          parent_version_id: null,
        },
      ];

      // Mock the select query
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockResolvedValue(mockDocuments);

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            orderBy: mockOrderBy,
          }),
        }),
      });

      const result = await getDocumentsById({ id: mockDocumentId });

      expect(result).toHaveLength(2);
      // Verify we can compare content between versions
      expect(result[0].content).toBe("Original content");
      expect(result[1].content).toBe("Updated content with changes");
      expect(result[0].content).not.toBe(result[1].content);
    });

    it("should include metadata in version comparison", async () => {
      const mockDocuments = [
        {
          id: mockDocumentId,
          title: "Document",
          kind: "text" as ArtifactKind,
          content: "Content",
          user_id: mockUserId,
          chat_id: mockChatId,
          version_number: 1,
          metadata: { status: "draft" },
          createdAt: new Date("2024-01-01"),
          parent_version_id: null,
        },
        {
          id: mockDocumentId,
          title: "Document",
          kind: "text" as ArtifactKind,
          content: "Content",
          user_id: mockUserId,
          chat_id: mockChatId,
          version_number: 2,
          metadata: { status: "published" },
          createdAt: new Date("2024-01-02"),
          parent_version_id: null,
        },
      ];

      // Mock the select query
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockResolvedValue(mockDocuments);

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            orderBy: mockOrderBy,
          }),
        }),
      });

      const result = await getDocumentsById({ id: mockDocumentId });

      expect(result[0].metadata).toEqual({ status: "draft" });
      expect(result[1].metadata).toEqual({ status: "published" });
    });

    it("should handle errors during version comparison query", async () => {
      // Mock select to throw error
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi
        .fn()
        .mockRejectedValue(new Error("Database error"));

      (db.select as any).mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            orderBy: mockOrderBy,
          }),
        }),
      });

      await expect(getDocumentsById({ id: mockDocumentId })).rejects.toThrow(
        ChatSDKError
      );
    });
  });
});
