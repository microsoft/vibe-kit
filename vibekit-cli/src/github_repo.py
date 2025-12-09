from __future__ import annotations
import base64
import json
import os
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib import error, request
from urllib.parse import parse_qs, quote, urlencode

_GITHUB_API_BASE = "https://api.github.com"
_MANIFEST_CANDIDATES = ("MANIFEST.yml", "manifest.yml", "manifest.yaml")
_GITHUB_TOKEN_ENV_OPTIONS = ("GIT_PAT", "GITHUB_PAT", "GITHUB_TOKEN", "GH_TOKEN")
GITHUB_SUPPORTED_HOSTS = {"github.com", "www.github.com"}
_HTTP_TIMEOUT = 10  # seconds
_HTTP_RETRIES = 3
_HTTP_BACKOFF_SECONDS = 1.0


def is_github_host(host: str) -> bool:
    return host in GITHUB_SUPPORTED_HOSTS


def parse_github_url(remote_url: str) -> Tuple[str, str, Optional[str], str]:
    from urllib.parse import urlparse

    parsed = urlparse(remote_url)
    segments = [segment for segment in parsed.path.split("/") if segment]
    if len(segments) < 2:
        raise ValueError("GitHub URL must include owner and repository.")
    owner, repository = segments[0], segments[1]
    ref: Optional[str] = None
    subdir_parts: List[str] = []
    if len(segments) >= 3:
        if segments[2] == "tree" and len(segments) >= 4:
            ref = segments[3]
            subdir_parts = segments[4:]
        else:
            subdir_parts = segments[2:]
    query = parse_qs(parsed.query)
    if "ref" in query and query["ref"]:
        ref = query["ref"][0]
    subdir = "/".join(subdir_parts)
    return owner, repository, ref, subdir


def list_github_repository(
    owner: str, repository: str, ref: Optional[str], subdir: str
) -> List[Dict[str, str]]:
    branch = ref or _github_default_branch(owner, repository)
    directory = subdir.strip("/")
    contents = _github_directory_contents(owner, repository, branch, directory)
    if contents is None:
        target = f"{repository}/{directory}" if directory else repository
        raise ValueError(f"GitHub path not found: {target}")
    entries: List[Dict[str, str]] = []
    for item in contents:
        if item.get("type") != "dir":
            continue
        name = item.get("name", "")
        if not name or name.startswith("."):
            continue
        manifest_meta = _github_manifest_metadata(owner, repository, branch, item.get("path", ""))
        kit_name = manifest_meta.get("id") or name
        version = manifest_meta.get("version") or "0.0.0"
        entries.append(
            {
                "id": kit_name,
                "version": version,
                "path": item.get("path", name),
            }
        )
    entries.sort(key=lambda entry: entry.get("id", ""))
    return entries


def download_github_kit(
    owner: str,
    repository: str,
    ref: Optional[str],
    subdir: str,
    kit_name: str,
    dest_root: Path,
) -> Tuple[Path, Dict[str, str]]:
    branch = ref or _github_default_branch(owner, repository)
    directory = subdir.strip("/")
    kit_remote_path, manifest_meta = _github_locate_kit(
        owner, repository, branch, directory, kit_name
    )
    local_dir_name = Path(kit_remote_path).name or kit_name
    local_dir = dest_root / local_dir_name
    _github_download_directory(owner, repository, branch, kit_remote_path, local_dir)
    return local_dir, manifest_meta


def _encode_path(path: str) -> str:
    if not path:
        return ""
    return "/".join(quote(segment, safe="") for segment in path.split("/") if segment)


def _github_locate_kit(
    owner: str,
    repository: str,
    branch: str,
    directory: str,
    kit_name: str,
) -> Tuple[str, Dict[str, str]]:
    contents = _github_directory_contents(owner, repository, branch, directory)
    if contents is None:
        target = f"{repository}/{directory}" if directory else repository
        raise ValueError(f"GitHub path not found: {target}")
    for item in contents:
        if item.get("type") != "dir":
            continue
        name = item.get("name", "")
        path = item.get("path", "")
        if not path:
            continue
        manifest_meta = _github_manifest_metadata(owner, repository, branch, path)
        manifest_id = manifest_meta.get("id") if manifest_meta else None
        matches = kit_name == name or kit_name == manifest_id
        if not matches:
            continue
        if not manifest_meta:
            manifest_meta = {
                "id": kit_name,
                "name": kit_name,
                "version": "0.0.0",
            }
        elif "id" not in manifest_meta:
            manifest_meta = {
                **manifest_meta,
                "id": kit_name,
                "name": manifest_meta.get("name", kit_name),
            }
        return path, manifest_meta
    raise ValueError(f"Unknown kit name: {kit_name}")


def _github_download_directory(
    owner: str, repository: str, branch: str, remote_path: str, dest_dir: Path
) -> None:
    contents = _github_directory_contents(owner, repository, branch, remote_path)
    if contents is None:
        raise ValueError(f"GitHub path not found: {remote_path}")
    dest_dir.mkdir(parents=True, exist_ok=True)
    for item in contents:
        item_path = item.get("path", "")
        name = item.get("name", "")
        item_type = item.get("type")
        if not item_path or not name:
            continue
        if item_type == "dir":
            _github_download_directory(owner, repository, branch, item_path, dest_dir / name)
            continue
        if item_type == "file":
            _github_download_file(owner, repository, branch, item_path, dest_dir / name)
            continue


def _github_download_file(
    owner: str, repository: str, branch: str, remote_path: str, dest_file: Path
) -> None:
    encoded_remote_path = _encode_path(remote_path)
    payload = _github_http_get(
        f"{_GITHUB_API_BASE}/repos/{owner}/{repository}/contents/{encoded_remote_path}",
        params={"ref": branch},
    )
    if not isinstance(payload, dict) or payload.get("type") != "file":
        raise RuntimeError(f"Failed to fetch file contents for {remote_path}")
    content = payload.get("content")
    encoding = (payload.get("encoding") or "").lower()
    download_url = payload.get("download_url")
    if content is None or encoding == "none":
        if not download_url:
            raise RuntimeError(f"Missing file content for {remote_path}")
        data = _github_http_get_raw(download_url)
    else:
        data = _decode_content_bytes(content, encoding)
    dest_file.parent.mkdir(parents=True, exist_ok=True)
    dest_file.write_bytes(data)


def _github_default_branch(owner: str, repository: str) -> str:
    url = f"{_GITHUB_API_BASE}/repos/{owner}/{repository}"
    data = _github_http_get(url)
    if not isinstance(data, dict):
        raise RuntimeError(f"Unable to determine default branch for {owner}/{repository}.")
    return data.get("default_branch") or "main"


def _github_directory_contents(
    owner: str, repository: str, branch: str, directory: str
) -> Optional[List[Dict[str, str]]]:
    path = f"/repos/{owner}/{repository}/contents"
    encoded_directory = _encode_path(directory)
    if encoded_directory:
        path = f"{path}/{encoded_directory}"
    payload = _github_http_get(f"{_GITHUB_API_BASE}{path}", params={"ref": branch})
    if payload is None:
        return None
    if not isinstance(payload, list):
        return None
    return payload


def _github_manifest_metadata(
    owner: str, repository: str, branch: str, kit_path: str
) -> Dict[str, str]:
    clean_path = kit_path.strip("/")
    for candidate in _MANIFEST_CANDIDATES:
        remote_path = f"{clean_path}/{candidate}" if clean_path else candidate
        encoded_remote_path = _encode_path(remote_path)
        file_payload = _github_http_get(
            f"{_GITHUB_API_BASE}/repos/{owner}/{repository}/contents/{encoded_remote_path}",
            params={"ref": branch},
            allow_404=True,
        )
        if not file_payload or not isinstance(file_payload, dict):
            continue
        content = file_payload.get("content")
        encoding = (file_payload.get("encoding") or "").lower()
        if not content:
            continue
        try:
            text = _decode_content(content, encoding)
        except ValueError:
            continue
        meta = _parse_manifest_content(text)
        if meta:
            return meta
    return {}


def _decode_content_bytes(raw: str, encoding: str) -> bytes:
    if encoding == "base64":
        try:
            return base64.b64decode(raw)
        except Exception as exc:  # pragma: no cover
            raise ValueError("Failed to decode base64 content") from exc
    if encoding in {"", "utf-8", "none"}:
        return raw.encode("utf-8")
    raise ValueError(f"Unsupported content encoding: {encoding}")


def _decode_content(raw: str, encoding: str) -> str:
    data = _decode_content_bytes(raw, encoding)
    try:
        return data.decode("utf-8")
    except Exception as exc:  # pragma: no cover
        raise ValueError("Failed to decode content as UTF-8") from exc


def _parse_manifest_content(content: str) -> Dict[str, str]:
    try:
        import yaml  # type: ignore
    except ImportError:  # pragma: no cover
        return {}
    try:
        data = yaml.safe_load(content) or {}
    except Exception:  # pragma: no cover
        return {}
    kit_info = data.get("kit_info", {}) or {}
    post_install = data.get("post_install", {}) or {}
    result = {
        "id": kit_info.get("name"),
        "name": kit_info.get("name"),
        "display_name": kit_info.get("display_name"),
        "version": kit_info.get("version"),
        "description": kit_info.get("description"),
        "created_date": kit_info.get("created_date"),
        "last_updated": kit_info.get("last_updated"),
        "post_install_instructions": post_install.get("instructions_markdown"),
    }
    return {k: v for k, v in result.items() if v is not None}


def _github_http_headers(accept: str) -> Dict[str, str]:
    headers = {
        "Accept": accept,
        "User-Agent": "vibekit-cli",
    }
    for env_name in _GITHUB_TOKEN_ENV_OPTIONS:
        token = os.getenv(env_name)
        if token:
            headers["Authorization"] = f"Bearer {token.strip()}"
            break
    return headers


def _with_retries(fn):
    last_exc = None
    for attempt in range(_HTTP_RETRIES):
        try:
            return fn()
        except error.URLError as exc:
            last_exc = exc
            if attempt == _HTTP_RETRIES - 1:
                raise
            time.sleep(_HTTP_BACKOFF_SECONDS * (attempt + 1))
    if last_exc:
        raise last_exc
    raise RuntimeError("Unexpected retry loop failure")  # pragma: no cover


def _github_http_get(url: str, params: Optional[Dict[str, str]] = None, allow_404: bool = False):
    target = url
    if params:
        target = f"{target}?{urlencode(params)}"
    headers = _github_http_headers("application/vnd.github.v3+json")
    req = request.Request(target, headers=headers)
    try:
        def _read():
            with request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
                raw = resp.read()
                charset = resp.headers.get_content_charset() or "utf-8"
                text = raw.decode(charset)
                if not text:
                    return {}
                return json.loads(text)

        return _with_retries(_read)
    except error.HTTPError as exc:
        if exc.code == 404 and allow_404:
            return None
        detail = exc.read().decode("utf-8", "ignore")
        message = _format_github_http_error(exc.code, detail)
        if exc.code in {401, 403, 404}:
            raise ValueError(message) from None
        raise RuntimeError(message) from None
    except error.URLError as exc:
        raise RuntimeError(f"Unable to reach GitHub (network error: {exc.reason})") from None


def _github_http_get_raw(url: str) -> bytes:
    headers = _github_http_headers("application/vnd.github.v3.raw")
    req = request.Request(url, headers=headers)
    try:
        def _read_raw() -> bytes:
            with request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
                return resp.read()

        return _with_retries(_read_raw)
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "ignore")
        message = _format_github_http_error(exc.code, detail)
        if exc.code in {401, 403, 404}:
            raise ValueError(message) from None
        raise RuntimeError(message) from None
    except error.URLError as exc:
        raise RuntimeError(f"Unable to reach GitHub (network error: {exc.reason})") from None


def _format_github_http_error(status: int, raw_detail: str) -> str:
    message_text = ""
    if raw_detail:
        try:
            payload = json.loads(raw_detail)
            if isinstance(payload, dict) and payload.get("message"):
                message_text = str(payload.get("message"))
        except Exception:
            message_text = raw_detail.strip()
    if status == 404:
        hint = "Repository or path not found. Verify the URL and ensure you have access (set GITHUB_TOKEN for private repos)."
        return f"GitHub returned 404: {hint}"
    if status in (401, 403):
        hint = "Access denied. Provide a GitHub token via GITHUB_TOKEN or GH_TOKEN for private repositories."
        return f"GitHub returned {status}: {hint}"
    base = f"GitHub returned status {status}."
    if message_text:
        return f"{base} Details: {message_text}"
    return base
