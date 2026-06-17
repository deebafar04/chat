import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { ChatSDKError } from "../../errors";
import { type GithubRepository, githubRepositories } from "../drizzle-schema";
import { getDb } from "./base";

export async function getGithubRepositoriesByUserId({
  userId,
  activeOnly = true,
}: {
  userId: string;
  activeOnly?: boolean;
}) {
  try {
    const conditions = [eq(githubRepositories.user_id, userId)];

    if (activeOnly) {
      conditions.push(eq(githubRepositories.isActive, true));
    }

    return await db
      .select()
      .from(githubRepositories)
      .where(and(...conditions))
      .orderBy(desc(githubRepositories.lastAccessed));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get github repositories by user id"
    );
  }
}

export async function getGithubRepositoryById({ id }: { id: string }) {
  try {
    const [repo] = await db
      .select()
      .from(githubRepositories)
      .where(eq(githubRepositories.id, id));
    return repo || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get github repository by id"
    );
  }
}

export async function addGithubRepository({
  userId,
  repoOwner,
  repoName,
  repoUrl,
  defaultBranch = "main",
}: {
  userId: string;
  repoOwner: string;
  repoName: string;
  repoUrl?: string;
  defaultBranch?: string;
}) {
  try {
    const [created] = await db
      .insert(githubRepositories)
      .values({
        id: crypto.randomUUID(),
        user_id: userId,
        repoOwner,
        repoName,
        repoUrl,
        defaultBranch,
        isActive: true,
        createdAt: new Date(),
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to add github repository"
    );
  }
}

export async function updateGithubRepository({
  id,
  isActive,
  lastAccessed,
  defaultBranch,
}: {
  id: string;
  isActive?: boolean;
  lastAccessed?: Date;
  defaultBranch?: string;
}) {
  try {
    const updates: Partial<GithubRepository> = {};

    if (isActive !== undefined) {
      updates.isActive = isActive;
    }
    if (lastAccessed) {
      updates.lastAccessed = lastAccessed;
    }
    if (defaultBranch) {
      updates.defaultBranch = defaultBranch;
    }

    const [updated] = await db
      .update(githubRepositories)
      .set(updates)
      .where(eq(githubRepositories.id, id))
      .returning();
    return updated;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update github repository"
    );
  }
}

export async function deleteGithubRepository({ id }: { id: string }) {
  try {
    const [deleted] = await db
      .delete(githubRepositories)
      .where(eq(githubRepositories.id, id))
      .returning();
    return deleted;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete github repository"
    );
  }
}
