import { createHash, randomUUID } from "crypto";
import { promises as fs } from "fs";
import * as path from "path";
import os from "os";
import { objectStorageClient } from "./objectStorage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export type ArtifactStorageMetadata = {
  objectPath: string;
  byteSize: number;
  mimeType: string;
  sha256: string;
};

export type PutArtifactInput = {
  bytes: Buffer;
  mimeType: string;
  sha256: string;
  keyHint?: string;
};

// Production-grade object-storage abstraction (Section M):
// putArtifact / getArtifactMetadata / createSignedDownloadUrl /
// deleteArtifact / verifyArtifactHash / quarantineArtifact
export interface ArtifactStore {
  putArtifact(input: PutArtifactInput): Promise<ArtifactStorageMetadata>;
  getArtifactMetadata(objectPath: string): Promise<ArtifactStorageMetadata | null>;
  getArtifactBytes(objectPath: string): Promise<Buffer | null>;
  createSignedDownloadUrl(objectPath: string, ttlSec?: number): Promise<string>;
  deleteArtifact(objectPath: string): Promise<void>;
  verifyArtifactHash(objectPath: string, expectedSha256: string): Promise<boolean>;
  quarantineArtifact(objectPath: string, reason: string): Promise<void>;
}

function parseObjectPath(fullPath: string): { bucketName: string; objectName: string } {
  const normalized = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
  const parts = normalized.split("/");
  if (parts.length < 3) throw new Error("Invalid object path");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

class GcsArtifactStore implements ArtifactStore {
  private privateDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) throw new Error("PRIVATE_OBJECT_DIR not set — object storage is not provisioned");
    return dir.endsWith("/") ? dir.slice(0, -1) : dir;
  }

  private fileFor(objectPath: string) {
    const { bucketName, objectName } = parseObjectPath(objectPath);
    return objectStorageClient.bucket(bucketName).file(objectName);
  }

  async putArtifact(input: PutArtifactInput): Promise<ArtifactStorageMetadata> {
    const objectPath = `${this.privateDir()}/clothing-artifacts/${input.keyHint ?? randomUUID()}.png`;
    const file = this.fileFor(objectPath);
    await file.save(input.bytes, {
      contentType: input.mimeType,
      resumable: false,
      metadata: { metadata: { sha256: input.sha256 } },
    });
    return { objectPath, byteSize: input.bytes.length, mimeType: input.mimeType, sha256: input.sha256 };
  }

  async getArtifactMetadata(objectPath: string): Promise<ArtifactStorageMetadata | null> {
    const file = this.fileFor(objectPath);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [meta] = await file.getMetadata();
    return {
      objectPath,
      byteSize: Number(meta.size ?? 0),
      mimeType: (meta.contentType as string) || "application/octet-stream",
      sha256: String((meta.metadata as Record<string, unknown> | undefined)?.sha256 ?? ""),
    };
  }

  async getArtifactBytes(objectPath: string): Promise<Buffer | null> {
    const file = this.fileFor(objectPath);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [contents] = await file.download();
    return contents;
  }

  async createSignedDownloadUrl(objectPath: string, ttlSec = 900): Promise<string> {
    const { bucketName, objectName } = parseObjectPath(objectPath);
    const response = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket_name: bucketName,
        object_name: objectName,
        method: "GET",
        expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`Failed to sign download URL (status ${response.status})`);
    }
    const { signed_url: signedUrl } = (await response.json()) as { signed_url: string };
    return signedUrl;
  }

  async deleteArtifact(objectPath: string): Promise<void> {
    await this.fileFor(objectPath).delete({ ignoreNotFound: true });
  }

  async verifyArtifactHash(objectPath: string, expectedSha256: string): Promise<boolean> {
    const bytes = await this.getArtifactBytes(objectPath);
    if (!bytes) return false;
    return createHash("sha256").update(bytes).digest("hex") === expectedSha256;
  }

  async quarantineArtifact(objectPath: string, reason: string): Promise<void> {
    const file = this.fileFor(objectPath);
    await file.setMetadata({ metadata: { quarantined: "true", quarantineReason: reason } });
  }
}

// Filesystem-backed store used in tests and environments without the Replit
// object-storage sidecar. Same contract, local durability only.
export class LocalArtifactStore implements ArtifactStore {
  constructor(private readonly rootDir: string = path.join(os.tmpdir(), "clothing-artifacts")) {}

  private resolve(objectPath: string): string {
    const safe = objectPath.replace(/^\/+/, "").replace(/\.\./g, "");
    return path.join(this.rootDir, safe);
  }

  async putArtifact(input: PutArtifactInput): Promise<ArtifactStorageMetadata> {
    const objectPath = `/local/clothing-artifacts/${input.keyHint ?? randomUUID()}.png`;
    const target = this.resolve(objectPath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, input.bytes);
    await fs.writeFile(`${target}.meta.json`, JSON.stringify({ sha256: input.sha256, mimeType: input.mimeType }));
    return { objectPath, byteSize: input.bytes.length, mimeType: input.mimeType, sha256: input.sha256 };
  }

  async getArtifactMetadata(objectPath: string): Promise<ArtifactStorageMetadata | null> {
    try {
      const target = this.resolve(objectPath);
      const [stat, metaRaw] = await Promise.all([fs.stat(target), fs.readFile(`${target}.meta.json`, "utf8")]);
      const meta = JSON.parse(metaRaw) as { sha256: string; mimeType: string };
      return { objectPath, byteSize: stat.size, mimeType: meta.mimeType, sha256: meta.sha256 };
    } catch {
      return null;
    }
  }

  async getArtifactBytes(objectPath: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolve(objectPath));
    } catch {
      return null;
    }
  }

  async createSignedDownloadUrl(objectPath: string, ttlSec = 900): Promise<string> {
    const expires = Date.now() + ttlSec * 1000;
    const token = createHash("sha256").update(`${objectPath}:${expires}`).digest("hex").slice(0, 32);
    return `file://${this.resolve(objectPath)}?expires=${expires}&token=${token}`;
  }

  async deleteArtifact(objectPath: string): Promise<void> {
    await fs.rm(this.resolve(objectPath), { force: true });
    await fs.rm(`${this.resolve(objectPath)}.meta.json`, { force: true });
  }

  async verifyArtifactHash(objectPath: string, expectedSha256: string): Promise<boolean> {
    const bytes = await this.getArtifactBytes(objectPath);
    if (!bytes) return false;
    return createHash("sha256").update(bytes).digest("hex") === expectedSha256;
  }

  async quarantineArtifact(objectPath: string, reason: string): Promise<void> {
    const target = this.resolve(objectPath);
    await fs.writeFile(`${target}.quarantine.json`, JSON.stringify({ quarantined: true, reason, at: new Date().toISOString() }));
  }
}

let defaultStore: ArtifactStore | null = null;

export function getArtifactStore(): ArtifactStore {
  if (!defaultStore) {
    defaultStore = process.env.PRIVATE_OBJECT_DIR ? new GcsArtifactStore() : new LocalArtifactStore();
  }
  return defaultStore;
}

export function setArtifactStoreForTesting(store: ArtifactStore | null): void {
  defaultStore = store;
}
