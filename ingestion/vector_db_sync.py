"""
Vector DB sync for the webroot superproject and its submodules.

Invocation modes
- changed_files.txt: python chat/ingestion/vector_db_sync.py <changed_files.txt>
  (lines from `git diff --name-status`)
- explicit files: python chat/ingestion/vector_db_sync.py --files A:path M:path D:path ...
  (status prefix optional; default is M if omitted)
- commit range replay (recommended):
  python chat/ingestion/vector_db_sync.py --from-commit <rev> [--to-commit HEAD] [--repo-root .]
  Expands submodule pointer changes into file-level A/M/D across changed submodules.
- full re-index (wipe and rebuild):
  python chat/ingestion/vector_db_sync.py --reindex-all [--repo-root .]
  Wipes all vectors and re-indexes the entire repository from scratch.

Behavior
- A/M: pre-delete vectors for the path (idempotent), then chunk + embed + upsert
- D: delete vectors for the path
- Rename: expanded to D old + M new (superproject and submodules)
- Embeddings are content-only; file path is stored in metadata
- Strict failure: unexpected errors fail the run; errors recorded to JSONL

Env vars
- PINECONE_API_KEY (required)
- VOYAGE_API_KEY (required)
- PINECONE_CLOUD (serverless; default: aws)
- PINECONE_REGION (serverless; default: us-east-1)
- PINECONE_ENV (classic fallback; default: us-west1-gcp)
- PINECONE_INDEX (optional, default: repo-chunks)
"""

# pyright: basic

import os
import sys
import uuid
import re
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Tuple, Optional
import time
import tiktoken
from tqdm import tqdm
import argparse
import subprocess

# LlamaIndex imports
from llama_chunker import LlamaChunker
from llama_index.embeddings.voyageai import VoyageEmbedding

# Constants
MAX_TOKENS = 8192
INDEX_NAME = "repo-chunks"
DEFAULT_NAMESPACE = ""  # Empty string = Pinecone default namespace (recommended for single consolidated namespace)
GIT_EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"  # Git's empty tree SHA - used for full reindex
EMBEDDING_MODEL = "voyage-code-3"  # SOTA code embedding model
DIMENSION = 1024  # voyage-code-3 dimension
METRIC = "cosine"
PINECONE_UPSERT_BATCH_SIZE = 32
EMBEDDING_BATCH_SIZE = 32

# Extensions we should not attempt to parse/chunk as text. We index them as a single metadata summary.
# This avoids embedding binary gibberish (images, archives, etc.) which is slow and error-prone.
BINARY_EXTS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".bmp",
    ".tiff",
    ".ico",
    ".psd",
    ".pdf",
    ".zip",
    ".gz",
    ".tar",
    ".7z",
    ".mp3",
    ".mp4",
    ".mov",
    ".avi",
    ".wav",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
}

# Files we don't want to chunk/embed as full content (lockfiles, etc).
# These are typically huge and low-value for code RAG, and can stall ingestion.
SUMMARY_ONLY_BASENAMES = {
    "pnpm-lock.yaml",
    "yarn.lock",
    "package-lock.json",
    "npm-shrinkwrap.json",
    "cargo.lock",
    "poetry.lock",
    "pipfile.lock",
    "gemfile.lock",
    "composer.lock",
}

# Prefer serverless Pinecone SDK; fallback to classic client if not available
USE_SERVERLESS = False
pc = None  # type: ignore
pinecone_client = None  # type: ignore
try:
    from pinecone import Pinecone, ServerlessSpec  # type: ignore

    USE_SERVERLESS = True
except Exception:
    try:
        import pinecone as pinecone_client  # type: ignore

        USE_SERVERLESS = False
    except Exception:
        pinecone_client = None  # type: ignore
        USE_SERVERLESS = False

# Clients are initialized in main() to avoid import-time failures
index = None
embed_model = None  # VoyageEmbedding instance
tokenizer = None
chunker = None  # LlamaChunker instance
logger = logging.getLogger("vector_db_sync")
if not logger.handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s:%(name)s:%(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
timing_stats = {
    "embed_calls": 0,
    "embed_texts": 0,
    "embed_seconds": 0.0,
    "pinecone_seconds": 0.0,
}


def reset_timing_stats() -> None:
    timing_stats["embed_calls"] = 0
    timing_stats["embed_texts"] = 0
    timing_stats["embed_seconds"] = 0.0
    timing_stats["pinecone_seconds"] = 0.0


def log_timing(message: str) -> None:
    logger.info(f"[timing] {message}")


def count_tokens(text: str) -> int:
    if tokenizer is None:
        # Should not happen (tokenizer initialized in main) but be safe
        return len(text.split())
    return len(tokenizer.encode(text, allowed_special="all"))


def re_chunk_if_oversize(sections: List[str], max_tokens: int = MAX_TOKENS) -> List[str]:
    final_chunks: List[str] = []
    for section in sections:
        section = section.strip()
        if not section:
            continue

        tokens = count_tokens(section)
        if tokens <= max_tokens:
            final_chunks.append(section)
        else:
            split_points = re.split(r'(?<=[.!?])\s+', section)
            current_chunk = ""

            for part in split_points:
                test_chunk = current_chunk + (" " + part if current_chunk else part)
                if count_tokens(test_chunk) <= max_tokens:
                    current_chunk = test_chunk
                else:
                    if current_chunk:
                        final_chunks.append(current_chunk.strip())
                    current_chunk = part

            if current_chunk.strip():
                final_chunks.append(current_chunk.strip())

            really_final: List[str] = []
            for chunk in final_chunks:
                if count_tokens(chunk) <= max_tokens:
                    really_final.append(chunk)
                else:
                    char_chunks = re.findall(r'.{1,3000}(?:\s+|$)', chunk)
                    really_final.extend([s.strip() for s in char_chunks if s.strip()])
            final_chunks = really_final

    return final_chunks


def detect_file_type(filepath: str) -> str:
    path = Path(filepath)
    ext = path.suffix.lower()

    if (ext == '' or ext in {'.sh'}) and path.exists():
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                first_line = f.readline().strip()
                if first_line.startswith('#!'):
                    if 'python' in first_line:
                        return 'python'
                    elif any(shell in first_line for shell in ['bash', 'sh', 'zsh']):
                        return 'bash'
        except Exception:
            pass

    return ext.lstrip('.')


# Chunking functions replaced by LlamaChunker
# chunk_code_tree_sitter, chunk_markdown, chunk_json_yaml removed


# chunk_ipynb removed - LlamaIndex JSONNodeParser handles .ipynb files as JSON

def chunk_csv_tsv(filepath: Path):
    """Simplified CSV/TSV handling without pandas dependency"""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = [f.readline() for _ in range(20)]  # Read first 20 lines

        content = ''.join(lines)
        summary = f"""CSV/TSV File: {filepath.name}
First 20 lines preview:
{content}
"""
        return re_chunk_if_oversize([summary]), True

    except Exception as e:
        # Keep should_embed=True to avoid upserting empty vectors.
        return [f"Error reading CSV {filepath}: {e}"], True


def chunk_topojson_summary(filepath: Path):
    """Build a compact, human-readable TopoJSON summary chunk."""
    path = Path(filepath)
    try:
        stat = path.stat()
        size_mb = stat.st_size / (1024 * 1024)
    except Exception as e:
        raise RuntimeError(f"Failed to stat TopoJSON file {filepath}: {e}")

    try:
        data = json.loads(path.read_text(encoding="utf-8", errors="strict"))
    except Exception as e:
        raise RuntimeError(f"Failed to parse TopoJSON file {filepath}: {e}")

    topo_type = data.get("type")
    if topo_type != "Topology":
        raise RuntimeError(f"Invalid TopoJSON type for {filepath}: {topo_type!r}")

    objects = data.get("objects")
    if not isinstance(objects, dict) or not objects:
        raise RuntimeError(f"Invalid TopoJSON objects for {filepath}")

    object_names = list(objects.keys())
    geometry_counts: dict = {}
    total_geometries = 0
    sample_ids: List[str] = []

    for obj in objects.values():
        if not isinstance(obj, dict):
            continue
        geometries = obj.get("geometries")
        if not isinstance(geometries, list):
            continue
        total_geometries += len(geometries)
        for geom in geometries:
            if not isinstance(geom, dict):
                continue
            geom_type = str(geom.get("type", "Unknown"))
            geometry_counts[geom_type] = int(geometry_counts.get(geom_type, 0)) + 1
            geom_id = geom.get("id")
            if geom_id is not None and len(sample_ids) < 12:
                sample_ids.append(str(geom_id))

    arcs = data.get("arcs")
    arc_count = len(arcs) if isinstance(arcs, list) else 0
    has_transform = isinstance(data.get("transform"), dict)

    object_preview = ", ".join(object_names[:8])
    if len(object_names) > 8:
        object_preview += ", ..."

    type_preview = ", ".join([f"{k}={v}" for k, v in sorted(geometry_counts.items())])
    if not type_preview:
        type_preview = "none"

    id_preview = ", ".join(sample_ids) if sample_ids else "none"

    summary = f"""TOPOJSON file: {path.name}
Path: {filepath}
Size: {size_mb:.2f} MB
Type: topojson
Topology: {topo_type}
Objects: {object_preview}
Geometry count: {total_geometries}
Geometry types: {type_preview}
Arc count: {arc_count}
Has transform: {"yes" if has_transform else "no"}
Sample IDs: {id_preview}
"""
    return re_chunk_if_oversize([summary]), True


def chunk_as_summary(filepath: Path):
    path = Path(filepath)
    file_type = detect_file_type(str(filepath))

    try:
        stat = path.stat()
        size_mb = stat.st_size / (1024 * 1024)

        summary = f"""{file_type.upper()} file: {path.name}
Path: {filepath}
Size: {size_mb:.2f} MB
Type: {file_type}
"""
        if size_mb < 1 and file_type in {'txt', 'log', 'conf', 'ini', 'cfg'}:
            try:
                preview = path.read_text(encoding='utf-8', errors='ignore')[:500]
                summary += f"\nPreview:\n{preview}..."
            except Exception:
                pass

        return re_chunk_if_oversize([summary]), True

    except Exception as e:
        # Keep should_embed=True to avoid upserting empty vectors.
        return [f"Error accessing {filepath}: {e}"], True


def dispatch_chunking(filepath: Path):
    """Simplified chunking - LlamaIndex replaces all custom AST parsing"""
    path = Path(filepath)
    ext = path.suffix.lower()

    # Lockfiles and similar artifacts: index as a single summary chunk.
    if path.name.lower() in SUMMARY_ONLY_BASENAMES:
        chunks, _ = chunk_as_summary(path)
        return chunks, True, "summary"

    # TopoJSON map datasets are large geometry payloads; index a compact structural preview.
    if path.name.lower().endswith(".topo.json"):
        chunks, _ = chunk_topojson_summary(path)
        return chunks, True, "summary"

    # Binary-ish assets: index a single summary chunk instead of trying to parse/chunk file bytes as text.
    if ext in BINARY_EXTS:
        chunks, _ = chunk_as_summary(path)
        return chunks, True, "summary"

    # CSV/TSV: simple preview (no pandas needed)
    if ext in {".csv", ".tsv"}:
        chunks, _ = chunk_csv_tsv(path)
        return chunks, True, "summary"

    # LlamaIndex handles: py, js, ts, java, cpp, go, rust, etc. (code)
    #                     md, txt, rst (markdown)
    #                     json, yaml, yml, ipynb (structured data)
    #                     html, css, xml (markup)
    try:
        chunks = chunker.chunk_file(str(filepath))
        if chunks:
            # Some formats (large JSON, lockfiles) can still exceed our embed token limit.
            # Re-chunk defensively so we never upsert empty embeddings.
            return re_chunk_if_oversize(chunks), True, "content"
    except Exception as e:
        logger.warning(f"LlamaChunker error for {filepath}: {e}")

    # Fallback: unsupported files get metadata summary
    chunks, _ = chunk_as_summary(path)
    return chunks, True, "summary"


def get_embedding(text: str) -> List[float]:
    """Generate embedding using Voyage AI's voyage-code-3 model"""
    if not text or not text.strip():
        raise RuntimeError("Empty text provided for embedding")
    try:
        # Use LlamaIndex VoyageEmbedding - get_text_embedding for documents
        embedding = embed_model.get_text_embedding(text)
        if not embedding:
            raise RuntimeError("Received empty embedding from API")
        if len(embedding) != DIMENSION:
            raise RuntimeError(
                f"Unexpected embedding dimension: got {len(embedding)}, expected {DIMENSION}"
            )
        # Pinecone rejects NaN/inf; fail early with a clear message.
        for v in embedding:
            if v != v or v == float("inf") or v == float("-inf"):
                raise RuntimeError("Embedding contains NaN/inf values")
        return embedding
    except Exception as e:
        raise RuntimeError(f"Embedding failed: {e}")


def get_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate embeddings in batches using Voyage AI's voyage-code-3 model."""
    if not texts:
        return []
    for text in texts:
        if not text or not text.strip():
            raise RuntimeError("Empty text provided for embedding batch")

    started = time.perf_counter()
    try:
        embeddings = embed_model.get_text_embedding_batch(texts)
        if not embeddings:
            raise RuntimeError("Received empty embedding batch from API")
        if len(embeddings) != len(texts):
            raise RuntimeError(
                f"Unexpected embedding batch size: got {len(embeddings)}, expected {len(texts)}"
            )

        for embedding in embeddings:
            if not embedding:
                raise RuntimeError("Received empty embedding in batch response")
            if len(embedding) != DIMENSION:
                raise RuntimeError(
                    f"Unexpected embedding dimension: got {len(embedding)}, expected {DIMENSION}"
                )
            for v in embedding:
                if v != v or v == float("inf") or v == float("-inf"):
                    raise RuntimeError("Embedding contains NaN/inf values")

        elapsed = time.perf_counter() - started
        timing_stats["embed_calls"] += 1
        timing_stats["embed_texts"] += len(texts)
        timing_stats["embed_seconds"] += elapsed
        return embeddings
    except Exception as e:
        elapsed = time.perf_counter() - started
        log_timing(f"embed_failed elapsed={elapsed:.3f}s")
        raise RuntimeError(f"Batch embedding failed: {e}")


def get_accurate_line_range(chunk: str, full_text: str) -> str:
    if not full_text or not chunk:
        return "L1-L1"

    try:
        chunk_clean = chunk.strip()
        if not chunk_clean:
            return "L1-L1"

        full_lines = full_text.split('\n')
        chunk_lines = chunk_clean.split('\n')

        first_chunk_line = chunk_lines[0].strip()
        if not first_chunk_line:
            return "L1-L1"

        for i, line in enumerate(full_lines):
            if first_chunk_line in line.strip() or line.strip() in first_chunk_line:
                start_line = i + 1
                end_line = start_line + len(chunk_lines) - 1
                return f"L{start_line}-L{end_line}"

        for i, line in enumerate(full_lines):
            if len(line.strip()) > 10 and line.strip() in chunk:
                start_line = i + 1
                chunk_line_count = chunk.count('\n') + 1
                end_line = start_line + chunk_line_count - 1
                return f"L{start_line}-L{end_line}"

        return "L1-L1"

    except Exception as e:
        logger.warning(f"Error calculating line range: {e}")
        return "L1-L1"


def process_file(filepath: str, status: str, repo_name: str, commit_sha: str):
    try:
        if not Path(filepath).exists():
            logger.warning(f"File not found: {filepath}")
            return []

        chunks, should_embed, chunk_type = dispatch_chunking(Path(filepath))
        chunk_entries = []

        full_text = ""
        if chunk_type == "content":
            try:
                full_text = Path(filepath).read_text(encoding="utf-8", errors="ignore")
            except Exception as e:
                logger.warning(f"Could not read full text for {filepath}: {e}")

        embeddable_entry_indexes: List[int] = []
        embeddable_texts: List[str] = []

        for i, chunk in enumerate(chunks):
            if not chunk or not chunk.strip():
                continue

            chunk_id = str(uuid.uuid4())
            token_count = count_tokens(chunk)

            chunk_entry = {
                "id": chunk_id,
                "values": [],
                "metadata": {
                    "repo_name": repo_name,
                    "file_path": str(filepath),
                    "file_type": detect_file_type(filepath),
                    "chunk_type": chunk_type,
                    "chunk_index": i,
                    "chunk_id": chunk_id,
                    "content": chunk,
                    "line_range": get_accurate_line_range(chunk, full_text),
                    "embedded": False,
                    "should_embed": bool(should_embed),
                    "status": status,
                    "token_count": token_count,
                    "commit_sha": commit_sha,
                    "indexed_at": datetime.utcnow().isoformat() + "Z"
                }
            }
            chunk_entries.append(chunk_entry)
            if should_embed and token_count <= MAX_TOKENS:
                embeddable_entry_indexes.append(len(chunk_entries) - 1)
                embeddable_texts.append(chunk)

        for i in tqdm(
            range(0, len(embeddable_texts), EMBEDDING_BATCH_SIZE),
            desc=f"Embedding {filepath}",
            leave=False,
        ):
            text_batch = embeddable_texts[i:i + EMBEDDING_BATCH_SIZE]
            embedding_batch = get_embeddings(text_batch)
            for j, embedding in enumerate(embedding_batch):
                entry_index = embeddable_entry_indexes[i + j]
                chunk_entries[entry_index]["values"] = embedding
                chunk_entries[entry_index]["metadata"]["embedded"] = True

        return chunk_entries

    except Exception as e:
        logger.error(f"Failed to process {filepath}: {e}")
        raise


def safe_delete_vectors(file_path: str, repo_name: str) -> None:
    try:
        _ = index.delete(
            filter={"repo_name": repo_name, "file_path": file_path},
            namespace=DEFAULT_NAMESPACE
        )
        logger.info(f"Deleted vectors for: {file_path}")
    except Exception as e:
        msg = str(e).lower()
        if "namespace not found" in msg or "code\":5" in msg:
            # Namespace hasn't been created yet; deletion is a no-op
            logger.info(f"Namespace absent on delete; skipping: {file_path}")
            return
        raise


def safe_upsert_batch(batch: List[dict], repo_name: str) -> int:
    for entry in batch:
        md = entry.get("metadata", {})
        if md.get("chunk_type") == "content" and not entry.get("values"):
            raise RuntimeError(f"Attempted to upsert empty embedding: {md.get('file_path')}")
    index.upsert(vectors=batch, namespace=DEFAULT_NAMESPACE)
    return len(batch)


def detect_github_commit_range() -> Tuple[str, str]:
    """
    Auto-detect commit range from GitHub Actions environment.
    Returns (from_commit, to_commit) tuple.
    Raises RuntimeError if not in GitHub Actions or if detection fails.
    """
    event_path = os.environ.get("GITHUB_EVENT_PATH")
    event_name = os.environ.get("GITHUB_EVENT_NAME")
    github_sha = os.environ.get("GITHUB_SHA")

    if not event_path:
        raise RuntimeError("GITHUB_EVENT_PATH not set. Cannot auto-detect commit range. "
                          "Provide --from-commit or run in GitHub Actions environment.")

    if not os.path.exists(event_path):
        raise RuntimeError(f"GitHub event file not found: {event_path}")

    try:
        with open(event_path, 'r', encoding='utf-8') as f:
            event = json.load(f)
    except Exception as e:
        raise RuntimeError(f"Failed to parse GitHub event file: {e}")

    if event_name == "push":
        base = event.get("before", "")
        head = github_sha or event.get("after", "")
    elif event_name == "pull_request":
        pr = event.get("pull_request", {})
        base = pr.get("base", {}).get("sha", "")
        head = pr.get("merge_commit_sha") or github_sha or ""
    else:
        raise RuntimeError(f"Unsupported GitHub event type: {event_name}. "
                          "Only 'push' and 'pull_request' events are supported. "
                          "Use --from-commit for manual runs.")

    # Handle empty tree / first commit
    if not base or base == "0000000000000000000000000000000000000000":
        if head:
            base = f"{head}^"
        else:
            raise RuntimeError("Cannot determine base commit: both base and head are missing from event data")

    if not head:
        raise RuntimeError("Cannot determine head commit: missing from GitHub event data")

    return (base, head)


def parse_args():
    parser = argparse.ArgumentParser(description="VectorDB sync")
    parser.add_argument("changed_files", nargs="?", help="Path to changed_files.txt from git diff --name-status")
    parser.add_argument("--files", nargs="*",
                        help="Explicit files to process. Accepts optional status prefix: A:path, M:path, D:path. Default is M if omitted.")
    parser.add_argument("--retry-errors", dest="retry_errors", nargs="?", const="chat/.vector_sync_errors.jsonl",
                        help="Retry files listed in an errors file (default: chat/.vector_sync_errors.jsonl)")
    parser.add_argument("--errors-out", dest="errors_out", default="chat/.vector_sync_errors.jsonl",
                        help="Path to write JSONL errors")
    parser.add_argument("--from-commit", dest="from_commit",
                        help="Compute changes from this commit/ref to HEAD or --to-commit. "
                             "For bulk ingestion of all files, use: 4b825dc642cb6eb9a060e54bf8d69288fbee4904 (empty tree)")
    parser.add_argument("--to-commit", dest="to_commit", default="HEAD", help="End commit/ref for diff (default: HEAD)")
    parser.add_argument("--repo-root", dest="repo_root", default=".",
                        help="Path to the git superproject root (default: current dir)")
    parser.add_argument("--reindex-all", action="store_true",
                        help="Wipe all vectors and re-index the entire repository from scratch. "
                             "Automatically handles the empty-tree comparison.")
    parser.add_argument("--skip-on-missing-keys", action="store_true",
                        help="Exit gracefully (code 0) if API keys are missing instead of raising an error")
    return parser.parse_args()


def append_error(path: str, file_path: str, operation: str, message: str, status: Optional[str] = None) -> None:
    try:
        rec = {"file_path": file_path, "operation": operation, "message": message}
        if status:
            rec["status"] = status
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec) + "\n")
    except Exception:
        # Swallow error; rely on idempotent commit-range replay for recovery
        pass


def _run_git(args: List[str], cwd: str) -> str:
    # Git will refuse to run on repos owned by a different OS user unless marked safe.
    # We pass safe.directory via -c so local runs (and automation users) work without mutating global git config.
    def _norm_safe_dir(p: str) -> str:
        # Git reports dubious ownership paths with forward slashes on Windows.
        # Match that normalization so `safe.directory` actually applies.
        try:
            resolved = str(Path(p).resolve())
        except Exception:
            resolved = p
        return resolved.replace("\\", "/")

    safe_dirs: List[str] = [_norm_safe_dir(cwd)]

    def _maybe_add_path(flag: str) -> None:
        if flag in args:
            idx = args.index(flag)
            if idx + 1 < len(args) and str(args[idx + 1]).strip():
                raw = str(args[idx + 1])
                safe_dirs.append(_norm_safe_dir(raw))

    _maybe_add_path("-C")
    _maybe_add_path("--git-dir")

    # Dedup while preserving order
    seen = set()
    safe_dirs_dedup: List[str] = []
    for d in safe_dirs:
        if d not in seen:
            seen.add(d)
            safe_dirs_dedup.append(d)

    cmd: List[str] = ["git"]
    for d in safe_dirs_dedup:
        cmd.extend(["-c", f"safe.directory={d}"])
    cmd.extend(args)

    cp = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if cp.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {cp.stderr.strip()}")
    return cp.stdout


def _parse_submodule_short(diff_text: str) -> List[Tuple[str, str, str]]:
    results: List[Tuple[str, str, str]] = []
    for line in diff_text.splitlines():
        # `git diff --submodule=short` may use either `..` or `...` between SHAs.
        m = re.match(r"^Submodule\s+([^\s]+)\s+([0-9a-f]{7,})\.{2,3}([0-9a-f]{7,}).*$", line.strip())
        if m:
            results.append((m.group(1), m.group(2), m.group(3)))
    return results


def _get_submodule_paths(repo_root: str) -> List[str]:
    gm = Path(repo_root) / ".gitmodules"
    if not gm.exists():
        return []

    try:
        out = _run_git(
            ["config", "--file", ".gitmodules", "--get-regexp", r"submodule\..*\.path"],
            repo_root,
        )
    except Exception:
        return []

    paths: List[str] = []
    for line in out.splitlines():
        parts = line.strip().split(None, 1)
        if len(parts) == 2 and parts[1].strip():
            # Normalize to forward slashes for Pinecone metadata consistency.
            paths.append(parts[1].strip().replace("\\", "/"))

    # Dedup while preserving order.
    seen = set()
    deduped: List[str] = []
    for p in paths:
        if p not in seen:
            seen.add(p)
            deduped.append(p)
    return deduped


def compute_reindex_all_files(repo_root: str, errors_out: str) -> List[Tuple[str, str]]:
    """
    For a full re-index, enumerate tracked files across the superproject and all submodules.

    This avoids relying on empty-tree diffs which include submodule "gitlink" paths (directories)
    and ensures we index actual files (e.g. `team/src/...`) rather than submodule pointers.
    """
    submodules = set(_get_submodule_paths(repo_root))

    # Superproject tracked files (exclude submodule gitlink entries).
    super_out = _run_git(["ls-files"], repo_root)
    all_files: List[str] = []
    for fp in super_out.splitlines():
        fp = fp.strip()
        if not fp:
            continue
        if fp in submodules:
            continue
        all_files.append(fp.replace("\\", "/"))

    # Submodule tracked files (prefixed by submodule path).
    for sub_path in sorted(submodules):
        sub_abs = Path(repo_root) / sub_path
        if not sub_abs.is_dir():
            append_error(errors_out, sub_path, "ls-files-submodule", "Submodule path not found on disk")
            continue
        try:
            out = _run_git(["-C", str(sub_abs), "ls-files"], repo_root)
        except Exception as e:
            append_error(errors_out, sub_path, "ls-files-submodule", str(e))
            continue

        for fp in out.splitlines():
            fp = fp.strip()
            if not fp:
                continue
            all_files.append(f"{sub_path}/{fp}".replace("\\", "/"))

    # Dedup while preserving order.
    seen = set()
    deduped: List[Tuple[str, str]] = []
    for fp in all_files:
        if fp not in seen:
            seen.add(fp)
            deduped.append(("A", fp))
    return deduped


def compute_changes_from_git(repo_root: str, from_rev: str, to_rev: str) -> List[Tuple[str, str]]:
    changes: List[Tuple[str, str]] = []
    # Superproject changes (expand renames)
    super_out = _run_git(["diff", "--name-status", from_rev, to_rev], repo_root)
    for line in super_out.splitlines():
        cols = line.strip().split("\t")
        if not cols:
            continue
        st = cols[0]
        if st.startswith("R") and len(cols) >= 3:
            # rename: old -> new
            changes.append(("D", cols[1]))
            changes.append(("M", cols[2]))
        elif len(cols) >= 2:
            changes.append((st, cols[1]))

    # Submodule pointer changes
    sub_out = _run_git(["diff", "--submodule=short", from_rev, to_rev], repo_root)
    for sub_path, oldsha, newsha in _parse_submodule_short(sub_out):
        sub_abs = str(Path(repo_root) / sub_path)
        sub_gitdir = str(Path(repo_root) / ".git" / "modules" / sub_path)
        added = (oldsha == "0000000" or re.fullmatch(r"0+", oldsha) is not None)
        deleted = (newsha == "0000000" or re.fullmatch(r"0+", newsha) is not None)
        try:
            if added:
                # List all files at newsha as added
                if Path(sub_abs).is_dir():
                    out = _run_git(["-C", sub_abs, "ls-tree", "-r", "--name-only", newsha], repo_root)
                else:
                    out = _run_git(["--git-dir", sub_gitdir, "ls-tree", "-r", "--name-only", newsha], repo_root)
                for f in out.splitlines():
                    if f.strip():
                        changes.append(("A", f"{sub_path}/{f}"))
            elif deleted:
                if Path(sub_gitdir).is_dir():
                    out = _run_git(["--git-dir", sub_gitdir, "ls-tree", "-r", "--name-only", oldsha], repo_root)
                else:
                    out = _run_git(["-C", sub_abs, "ls-tree", "-r", "--name-only", oldsha], repo_root)
                for f in out.splitlines():
                    if f.strip():
                        changes.append(("D", f"{sub_path}/{f}"))
            else:
                # Regular diff inside submodule
                if Path(sub_abs).is_dir():
                    out = _run_git(["-C", sub_abs, "diff", "--name-status", oldsha, newsha], repo_root)
                else:
                    out = _run_git(["--git-dir", sub_gitdir, "diff", "--name-status", oldsha, newsha], repo_root)
                for line in out.splitlines():
                    cols = line.strip().split("\t")
                    if not cols:
                        continue
                    st = cols[0]
                    if st.startswith("R") and len(cols) >= 3:
                        changes.append(("D", f"{sub_path}/{cols[1]}"))
                        changes.append(("M", f"{sub_path}/{cols[2]}"))
                    elif len(cols) >= 2:
                        changes.append((st, f"{sub_path}/{cols[1]}"))
        except Exception as e:
            append_error("chat/.vector_sync_errors.jsonl", sub_path, "diff-submodule", str(e))

    return changes


def main_entry():
    args = parse_args()

    # Validate required API keys
    missing_keys = []
    if not os.environ.get("PINECONE_API_KEY"):
        missing_keys.append("PINECONE_API_KEY")
    if not os.environ.get("VOYAGE_API_KEY"):
        missing_keys.append("VOYAGE_API_KEY")

    if missing_keys:
        if args.skip_on_missing_keys:
            logger.info(f"Skipping VectorDB sync due to missing API keys: {', '.join(missing_keys)}")
            sys.exit(0)
        else:
            raise RuntimeError(f"Missing required API keys: {', '.join(missing_keys)}")

    errors_out = args.errors_out
    files_to_process: List[Tuple[str, str]] = []

    # Validate --reindex-all is not combined with other input modes
    if args.reindex_all and (args.files or args.retry_errors or args.changed_files):
        raise RuntimeError("--reindex-all cannot be combined with --files, --retry-errors, or changed_files")

    if args.reindex_all:
        logger.info("--reindex-all: Will wipe all vectors and re-index everything")
        files_to_process = compute_reindex_all_files(args.repo_root, errors_out)
        if not files_to_process:
            raise RuntimeError(
                "No tracked files found to index. Make sure the superproject is a git repo and submodules are checked out."
            )
    elif args.files:
        def parse_token(tok: str) -> tuple:
            if ":" in tok:
                st, path = tok.split(":", 1)
                st = st.strip().upper()
                if st not in {"A", "M", "D"}:
                    raise RuntimeError(f"Invalid status prefix in --files token: {tok}")
                return (st, path)
            return ("M", tok)

        for tok in args.files:
            files_to_process.append(parse_token(tok))
    elif args.retry_errors:
        src = Path(args.retry_errors)
        if src.exists():
            for line in src.read_text(encoding="utf-8").splitlines():
                try:
                    obj = json.loads(line)
                    fp = obj.get("file_path")
                    st = (obj.get("status") or "M").upper()
                    if st not in {"A", "M", "D"}:
                        st = "M"
                    if fp:
                        files_to_process.append((st, fp))
                except Exception:
                    continue
        else:
            raise RuntimeError(f"Errors file not found: {args.retry_errors}")
    else:
        from_commit = args.from_commit
        to_commit = args.to_commit or "HEAD"

        # Auto-detect commit range from GitHub Actions if not explicitly provided
        if not from_commit and not args.changed_files:
            from_commit, to_commit = detect_github_commit_range()
            logger.info(f"Auto-detected commit range from GitHub Actions: {from_commit}..{to_commit}")

        if from_commit:
            changes = compute_changes_from_git(args.repo_root, from_commit, to_commit)
            for st, fp in changes:
                if st.startswith('R'):
                    continue
                files_to_process.append((st, fp))
        elif args.changed_files:
            # Parse changed files
            with open(args.changed_files, 'r', encoding='utf-8') as f:
                lines = [ln.strip() for ln in f.readlines() if ln.strip()]
            for line in lines:
                parts = line.split(None, 2)
                status = parts[0]
                if status.startswith('R'):
                    if len(parts) >= 3:
                        old_fp = parts[1];
                        new_fp = parts[2]
                        files_to_process.append(("D", old_fp))
                        files_to_process.append(("M", new_fp))
                    else:
                        raise RuntimeError(f"Malformed rename line: {line}")
                else:
                    fp = parts[1] if len(parts) > 1 else ""
                    if fp:
                        files_to_process.append((status, fp))
        else:
            raise RuntimeError("Usage: provide one of: --files, --retry-errors, --from-commit, --reindex-all, or changed_files path")

    run_sync(files_to_process, errors_out, repo_root=args.repo_root, wipe_first=args.reindex_all)


def run_sync(files_to_process: List[Tuple[str, str]], errors_out: str, repo_root: str, wipe_first: bool = False):
    # Environment context - repo_name used for metadata tagging
    github_repo = (os.getenv("GITHUB_REPOSITORY") or "").strip()
    repo_name = github_repo.split("/")[-1] if github_repo else ""
    if not repo_name:
        # Local runs may not have GitHub env; fall back to the repo root directory name.
        repo_name = Path(repo_root).resolve().name or "unknown"
    commit_sha = os.getenv("GITHUB_SHA", "unknown")
    reset_timing_stats()
    run_started = time.perf_counter()

    # Initialize external clients and tokenizer lazily
    global index, tokenizer, pc
    index_name = os.getenv("PINECONE_INDEX", INDEX_NAME)
    api_key = os.environ.get("PINECONE_API_KEY", "")

    if USE_SERVERLESS:
        from pinecone import Pinecone, ServerlessSpec  # type: ignore
        pc = Pinecone(api_key=api_key)
        # Ensure index exists (serverless)
        try:
            idxs = pc.list_indexes()
            names = []
            if hasattr(idxs, "indexes"):
                names = [ix.name for ix in idxs.indexes]
            else:
                names = [getattr(ix, "name", None) or ix.get("name") for ix in idxs]  # type: ignore
            if index_name not in set([n for n in names if n]):
                cloud = os.getenv("PINECONE_CLOUD", "aws")
                region = os.getenv("PINECONE_REGION", "us-east-1")
                logger.info(
                    f"Creating Pinecone serverless index '{index_name}' (dim={DIMENSION}, metric={METRIC}, cloud={cloud}, region={region})")
                try:
                    pc.create_index(
                        name=index_name,
                        dimension=DIMENSION,
                        metric=METRIC,
                        spec=ServerlessSpec(cloud=cloud, region=region),
                    )
                except Exception as e:
                    logger.warning(f"create_index failed or already exists: {e}")
        except Exception as e:
            logger.warning(f"Could not list/create serverless index: {e}")
        index = pc.Index(index_name)
    else:
        if pinecone_client is None:
            raise RuntimeError(
                "Pinecone SDK not available. Install 'pinecone' for serverless or 'pinecone-client' for classic.")
        pinecone_client.init(
            api_key=api_key,
            environment=os.getenv("PINECONE_ENV", "us-west1-gcp")
        )
        # Ensure index exists (classic client)
        try:
            existing = []
            try:
                existing = pinecone_client.list_indexes()
            except Exception:
                existing = []
            if isinstance(existing, dict) and "indexes" in existing:
                existing = [ix.get("name") for ix in existing.get("indexes", [])]
            if index_name not in set(existing or []):
                logger.info(f"Creating Pinecone classic index '{index_name}' (dim={DIMENSION}, metric={METRIC})")
                try:
                    pinecone_client.create_index(index_name, dimension=DIMENSION, metric=METRIC)
                except Exception as e:
                    logger.warning(f"create_index failed: {e}")
        except Exception as e:
            logger.warning(f"Could not verify/create classic index '{index_name}': {e}")
        index = pinecone_client.Index(index_name)

    # Initialize Voyage AI embedding model via LlamaIndex
    voyage_key = os.environ.get("VOYAGE_API_KEY", "")
    if not voyage_key:
        raise RuntimeError("VOYAGE_API_KEY not set")
    global embed_model
    embed_model = VoyageEmbedding(
        model_name=EMBEDDING_MODEL,
        voyage_api_key=voyage_key
    )
    tokenizer = tiktoken.get_encoding("cl100k_base")

    # Initialize LlamaChunker for unified chunking
    global chunker
    chunker = LlamaChunker()

    logger.info(f"Starting VectorDB sync for {repo_name} (commit: {commit_sha[:8]})")
    logger.info("Using LlamaIndex for intelligent code-aware chunking")
    logger.info(f"Namespace: '{DEFAULT_NAMESPACE}' (default)" if DEFAULT_NAMESPACE == "" else f"Namespace: '{DEFAULT_NAMESPACE}'")
    logger.info(f"Metadata tag: repo_name='{repo_name}'")

    # Wipe all vectors before syncing (used by --reindex-all)
    if wipe_first:
        logger.warning(f"!!! WIPING ALL VECTORS IN NAMESPACE '{DEFAULT_NAMESPACE or '(default)'}' !!!")
        try:
            index.delete(delete_all=True, namespace=DEFAULT_NAMESPACE)
            logger.info("Namespace wiped successfully.")
        except Exception as e:
            # Handle case where namespace doesn't exist yet
            if "namespace not found" in str(e).lower():
                logger.info("Namespace was empty, nothing to wipe.")
            else:
                raise RuntimeError(f"Failed to wipe namespace: {e}")

    file_stats = {"processed": 0, "errors": 0, "skipped": 0}
    failures: List[dict] = []
    deleted_files = 0
    upserted_ids: List[str] = []
    total_upserted = 0

    # Process files
    for status, filepath in files_to_process:
        file_started = time.perf_counter()
        embed_before = float(timing_stats["embed_seconds"])
        pinecone_before = float(timing_stats["pinecone_seconds"])

        def _log_file_timing() -> None:
            total_elapsed = time.perf_counter() - file_started
            embed_elapsed = max(0.0, float(timing_stats["embed_seconds"]) - embed_before)
            pinecone_elapsed = max(0.0, float(timing_stats["pinecone_seconds"]) - pinecone_before)
            other_elapsed = max(0.0, total_elapsed - embed_elapsed - pinecone_elapsed)
            if total_elapsed > 0:
                embed_pct = (embed_elapsed / total_elapsed) * 100.0
                pinecone_pct = (pinecone_elapsed / total_elapsed) * 100.0
                other_pct = (other_elapsed / total_elapsed) * 100.0
            else:
                embed_pct = 0.0
                pinecone_pct = 0.0
                other_pct = 0.0
            log_timing(
                f"file={filepath} embedding={embed_elapsed:.3f}s ({embed_pct:.1f}%) "
                f"pinecone={pinecone_elapsed:.3f}s ({pinecone_pct:.1f}%) "
                f"other={other_elapsed:.3f}s ({other_pct:.1f}%) total_time={total_elapsed:.3f}s"
            )

        try:
            path = Path(filepath)
            if path.exists() and path.is_dir():
                # Submodule entries can appear as paths in some diff modes; skip directories to avoid false failures.
                file_stats["skipped"] += 1
                append_error(errors_out, filepath, "skip-dir", "Path is a directory; skipping", status=status)
                _log_file_timing()
                continue

            if status == "D":
                pinecone_started = time.perf_counter()
                safe_delete_vectors(filepath, repo_name)
                timing_stats["pinecone_seconds"] += (time.perf_counter() - pinecone_started)
                deleted_files += 1
                _log_file_timing()
                continue

            if not path.exists():
                file_stats["skipped"] += 1
                raise FileNotFoundError(f"File marked as {status} but not found: {filepath}")

            if status in ("A", "M") and not wipe_first:
                # Keep idempotency when re-chunking changes chunk counts/ids.
                pinecone_started = time.perf_counter()
                safe_delete_vectors(filepath, repo_name)
                timing_stats["pinecone_seconds"] += (time.perf_counter() - pinecone_started)
                deleted_files += 1

            chunks = process_file(filepath, status, repo_name, commit_sha)

            if chunks:
                for i in tqdm(
                    range(0, len(chunks), PINECONE_UPSERT_BATCH_SIZE),
                    desc=f"Upserting {filepath}",
                    leave=False,
                ):
                    batch = chunks[i:i + PINECONE_UPSERT_BATCH_SIZE]
                    try:
                        pinecone_started = time.perf_counter()
                        upserted_count = safe_upsert_batch(batch, repo_name)
                        timing_stats["pinecone_seconds"] += (time.perf_counter() - pinecone_started)
                        total_upserted += upserted_count
                        for it in batch:
                            uid = it.get('id')
                            if isinstance(uid, str):
                                upserted_ids.append(uid)
                    except Exception as e:
                        file_stats["errors"] += 1
                        failures.append({"file_path": filepath, "operation": "upsert", "message": str(e), "status": status})
                        append_error(errors_out, filepath, "upsert", str(e), status=status)

            file_stats["processed"] += 1
            _log_file_timing()
        except Exception as e:
            file_stats["errors"] += 1
            failures.append({"file_path": filepath, "operation": "process", "message": str(e), "status": status})
            append_error(errors_out, filepath, "process", str(e), status=status)
            _log_file_timing()

    logger.info(f"\nSync Complete for {repo_name}:")
    logger.info(f"  - Namespace: '{DEFAULT_NAMESPACE}' (default)" if DEFAULT_NAMESPACE == "" else f"  - Namespace: '{DEFAULT_NAMESPACE}'")
    logger.info(f"  - Files processed: {file_stats['processed']}")
    logger.info(f"  - Files skipped: {file_stats['skipped']}")
    logger.info(f"  - Files with errors: {file_stats['errors']}")
    logger.info(f"  - Vectors deleted: {deleted_files} files")
    logger.info(f"  - Chunks upserted: {total_upserted}")
    logger.info(f"  - Embedding model: {EMBEDDING_MODEL}")
    total_embed_seconds = float(timing_stats["embed_seconds"])
    total_pinecone_seconds = float(timing_stats["pinecone_seconds"])
    total_run_seconds = time.perf_counter() - run_started
    total_other_seconds = max(0.0, total_run_seconds - total_embed_seconds - total_pinecone_seconds)
    if total_run_seconds > 0:
        embed_pct = (total_embed_seconds / total_run_seconds) * 100.0
        pinecone_pct = (total_pinecone_seconds / total_run_seconds) * 100.0
        other_pct = (total_other_seconds / total_run_seconds) * 100.0
    else:
        embed_pct = 0.0
        pinecone_pct = 0.0
        other_pct = 0.0
    log_timing(
        f"summary embedding={total_embed_seconds:.3f}s ({embed_pct:.1f}%) "
        f"pinecone={total_pinecone_seconds:.3f}s ({pinecone_pct:.1f}%) "
        f"other={total_other_seconds:.3f}s ({other_pct:.1f}%) total_time={total_run_seconds:.3f}s"
    )
    if failures:
        logger.error(
            f"{len(failures)} failures encountered. See {errors_out} for details. Use --retry-errors to re-run.")
        for f in failures:
            logger.error(
                f"  - failure: op={f.get('operation')} status={f.get('status')} file={f.get('file_path')} message={f.get('message')}")
        raise SystemExit(1)
    return {"namespace": DEFAULT_NAMESPACE, "repo_name": repo_name, "upserted_ids": upserted_ids}


if __name__ == "__main__":
    main_entry()

