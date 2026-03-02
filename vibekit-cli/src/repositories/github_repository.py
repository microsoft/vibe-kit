from __future__ import annotations

import base64
import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple
from urllib import error, request
from urllib.parse import parse_qs, quote, urlencode, urlparse

from manifests import (
    SKILL_FILE_NAME,
    LEGACY_INNOVATION_KIT_FILE_NAME,
    extract_kit_metadata,
)

from .repository_interface import InstallResult, KitRepositoryInterface, KitSummary


class GithubKitRepository(KitRepositoryInterface):
    """Repository implementation backed by a remote GitHub source."""

    _GITHUB_API_BASE = "https://api.github.com"
    _MANIFEST_CANDIDATES = ("MANIFEST.yml", "manifest.yml", "manifest.yaml")
    _SKILL_DESCRIPTOR_CANDIDATES = (SKILL_FILE_NAME, LEGACY_INNOVATION_KIT_FILE_NAME)
    _GITHUB_TOKEN_ENV_OPTIONS = ("GIT_PAT", "GITHUB_PAT", "GITHUB_TOKEN", "GH_TOKEN")
    _GITHUB_SUPPORTED_HOSTS = {"github.com", "www.github.com"}

    def __init__(self, repository_id: str, remote_url: str) -> None:
        super().__init__(repository_id)
        self.remote_url = remote_url

    def list_kits(self) -> tuple[KitSummary, ...]:
        entries = [
            KitSummary(
                identifier=entry.get("id", ""),
                name=entry.get("name") or entry.get("id", ""),
                version=entry.get("version"),
                description=entry.get("description"),
                source_hint=entry.get("url") or entry.get("path") or self.remote_url,
                legacy_descriptor=bool(entry.get("legacy_descriptor", False)),
            )
            for entry in self._list_remote_repo_kits(self.remote_url)
        ]
        entries.sort(key=lambda summary: summary.identifier)
        return tuple(entries)

    def install(self, kit_name: str, destination: Path) -> InstallResult:
        if destination.exists():
            raise FileExistsError(f"Destination already exists: {destination}")

        temp_dir_ctx = tempfile.TemporaryDirectory(prefix="vibekit-remote-")
        temp_dir = Path(temp_dir_ctx.name)
        try:
            source_dir, manifest_meta = self._download_remote_kit(
                self.remote_url,
                kit_name,
                temp_dir,
            )
            shutil.copytree(source_dir, destination)
            manifest_meta = manifest_meta or extract_kit_metadata(destination, kit_name)
            post_install = manifest_meta.get("post_install_instructions") if isinstance(manifest_meta, dict) else None
            return InstallResult(
                kit_name=kit_name,
                location=destination,
                metadata=manifest_meta,
                source_path=destination,
                post_install=post_install,
            )
        finally:
            temp_dir_ctx.cleanup()

    def uninstall(self, kit_name: str, destination: Path) -> bool:
        if not destination.exists():
            return False
        shutil.rmtree(destination)
        return True

    def update(self, kit_name: str, destination: Path) -> InstallResult:
        temp_dir_ctx = tempfile.TemporaryDirectory(prefix="vibekit-remote-")
        temp_dir = Path(temp_dir_ctx.name)
        try:
            source_dir, manifest_meta = self._download_remote_kit(
                self.remote_url,
                kit_name,
                temp_dir,
            )

            if destination.exists():
                shutil.rmtree(destination)

            shutil.copytree(source_dir, destination)

            manifest_meta = manifest_meta or extract_kit_metadata(destination, kit_name)

            post_install = manifest_meta.get("post_install_instructions") if isinstance(manifest_meta, dict) else None

            return InstallResult(
                kit_name=kit_name,
                location=destination,
                metadata=manifest_meta,
                source_path=destination,
                post_install=post_install,
            )
        finally:
            temp_dir_ctx.cleanup()

    @staticmethod
    def _download_remote_kit(
        remote_url: str, kit_name: str, dest_root: Path
    ) -> Tuple[Path, Dict[str, str]]:
        if remote_url.startswith("git@"):
            raise NotImplementedError(
                "SSH Git URLs are not supported yet; use an HTTPS repository URL."
            )
        dest_root.mkdir(parents=True, exist_ok=True)
        parsed = urlparse(remote_url)
        host = (parsed.netloc.split(":", 1)[0] or "").lower()
        if not host:
            raise ValueError("Remote repository URL is invalid.")
        if GithubKitRepository._is_github_host(host):
            owner, repo, ref, subdir = GithubKitRepository._parse_github_url(remote_url)
            return GithubKitRepository._download_github_kit(owner, repo, ref, subdir, kit_name, dest_root)
        if host in {"gitlab.com", "www.gitlab.com"}:
            raise NotImplementedError("GitLab remote repositories are not supported yet.")
        if host in {"bitbucket.org", "www.bitbucket.org"}:
            raise NotImplementedError("Bitbucket remote repositories are not supported yet.")
        raise NotImplementedError(
            f"Remote repository host '{host or parsed.netloc}' is not supported yet."
        )

    @staticmethod
    def _list_remote_repo_kits(remote_url: str) -> List[Dict[str, str]]:
        return GithubKitRepository._fetch_remote_repo_listing(remote_url)

    @staticmethod
    def _fetch_remote_repo_listing(remote_url: str) -> List[Dict[str, str]]:
        if remote_url.startswith("git@"):
            raise NotImplementedError(
                "SSH Git URLs are not supported yet; use an HTTPS repository URL."
            )
        parsed = urlparse(remote_url)
        host = (parsed.netloc.split(":", 1)[0] or "").lower()
        if not host:
            raise ValueError("Remote repository URL is invalid.")
        if GithubKitRepository._is_github_host(host):
            owner, repo, ref, subdir = GithubKitRepository._parse_github_url(remote_url)
            return GithubKitRepository._list_github_repository(owner, repo, ref, subdir)
        if host in {"gitlab.com", "www.gitlab.com"}:
            raise NotImplementedError("GitLab remote repositories are not supported yet.")
        if host in {"bitbucket.org", "www.bitbucket.org"}:
            raise NotImplementedError("Bitbucket remote repositories are not supported yet.")
        raise NotImplementedError(
            f"Remote repository host '{host or parsed.netloc}' is not supported yet."
        )

    @staticmethod
    def _is_github_host(host: str) -> bool:
        return host in GithubKitRepository._GITHUB_SUPPORTED_HOSTS

    @staticmethod
    def _parse_github_url(remote_url: str) -> Tuple[str, str, Optional[str], str]:
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

    @staticmethod
    def _list_github_repository(
        owner: str, repository: str, ref: Optional[str], subdir: str
    ) -> List[Dict[str, str]]:
        branch = ref or GithubKitRepository._github_default_branch(owner, repository)
        directory = subdir.strip("/")
        contents = GithubKitRepository._github_directory_contents(owner, repository, branch, directory)
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
            item_path = item.get("path", "")
            manifest_meta = GithubKitRepository._github_kit_metadata(owner, repository, branch, item_path)
            kit_name = manifest_meta.get("id") or name
            version = manifest_meta.get("version") or "0.0.0"
            encoded_branch = quote(branch, safe="")
            encoded_path = GithubKitRepository._encode_path(item_path)
            tree_suffix = f"/{encoded_path}" if encoded_path else ""
            entries.append(
                {
                    "id": kit_name,
                    "name": manifest_meta.get("name") or kit_name,
                    "description": manifest_meta.get("description"),
                    "version": version,
                    "path": item_path or name,
                    "url": f"https://github.com/{owner}/{repository}/tree/{encoded_branch}{tree_suffix}",
                    "legacy_descriptor": bool(manifest_meta.get("legacy_descriptor", False)),
                }
            )
        entries.sort(key=lambda entry: entry.get("id", ""))
        return entries

    @staticmethod
    def _download_github_kit(
        owner: str,
        repository: str,
        ref: Optional[str],
        subdir: str,
        kit_name: str,
        dest_root: Path,
    ) -> Tuple[Path, Dict[str, str]]:
        branch = ref or GithubKitRepository._github_default_branch(owner, repository)
        directory = subdir.strip("/")
        kit_remote_path, manifest_meta = GithubKitRepository._github_locate_kit(
            owner, repository, branch, directory, kit_name
        )
        local_dir_name = Path(kit_remote_path).name or kit_name
        local_dir = dest_root / local_dir_name
        GithubKitRepository._github_download_directory(owner, repository, branch, kit_remote_path, local_dir)
        return local_dir, manifest_meta

    @staticmethod
    def _encode_path(path: str) -> str:
        if not path:
            return ""
        return "/".join(quote(segment, safe="") for segment in path.split("/") if segment)

    @staticmethod
    def _github_locate_kit(
        owner: str,
        repository: str,
        branch: str,
        directory: str,
        kit_name: str,
    ) -> Tuple[str, Dict[str, str]]:
        contents = GithubKitRepository._github_directory_contents(owner, repository, branch, directory)
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
            manifest_meta = GithubKitRepository._github_kit_metadata(owner, repository, branch, path)
            manifest_id = manifest_meta.get("id") if manifest_meta else None
            matches = kit_name == name or kit_name == manifest_id
            if not matches:
                continue
            normalized_meta = dict(manifest_meta) if manifest_meta else {}
            normalized_meta.setdefault("id", kit_name)
            normalized_meta.setdefault("name", normalized_meta.get("name", kit_name))
            normalized_meta.setdefault("version", "0.0.0")
            return path, normalized_meta
        raise ValueError(f"Unknown kit name: {kit_name}")

    @staticmethod
    def _github_download_directory(
        owner: str, repository: str, branch: str, remote_path: str, dest_dir: Path
    ) -> None:
        contents = GithubKitRepository._github_directory_contents(owner, repository, branch, remote_path)
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
                GithubKitRepository._github_download_directory(owner, repository, branch, item_path, dest_dir / name)
                continue
            if item_type == "file":
                GithubKitRepository._github_download_file(owner, repository, branch, item_path, dest_dir / name)

    @staticmethod
    def _github_download_file(
        owner: str, repository: str, branch: str, remote_path: str, dest_file: Path
    ) -> None:
        encoded_remote_path = GithubKitRepository._encode_path(remote_path)
        payload = GithubKitRepository._github_http_get(
            f"{GithubKitRepository._GITHUB_API_BASE}/repos/{owner}/{repository}/contents/{encoded_remote_path}",
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
            data = GithubKitRepository._github_http_get(download_url, mode="raw")
        else:
            data = GithubKitRepository._decode_content_bytes(content, encoding)
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        dest_file.write_bytes(data)

    @staticmethod
    def _github_default_branch(owner: str, repository: str) -> str:
        url = f"{GithubKitRepository._GITHUB_API_BASE}/repos/{owner}/{repository}"
        data = GithubKitRepository._github_http_get(url)
        if not isinstance(data, dict):
            raise RuntimeError(
                f"Unable to determine default branch for {owner}/{repository}."
            )
        return data.get("default_branch") or "main"

    @staticmethod
    def _github_directory_contents(
        owner: str, repository: str, branch: str, directory: str
    ) -> Optional[List[Dict[str, str]]]:
        path = f"/repos/{owner}/{repository}/contents"
        encoded_directory = GithubKitRepository._encode_path(directory)
        if encoded_directory:
            path = f"{path}/{encoded_directory}"
        payload = GithubKitRepository._github_http_get(
            f"{GithubKitRepository._GITHUB_API_BASE}{path}", params={"ref": branch}
        )
        if payload is None:
            return None
        if not isinstance(payload, list):
            return None
        return payload

    @staticmethod
    def _github_manifest_metadata(
        owner: str, repository: str, branch: str, kit_path: str
    ) -> Dict[str, str]:
        clean_path = kit_path.strip("/")
        for candidate in GithubKitRepository._MANIFEST_CANDIDATES:
            remote_path = f"{clean_path}/{candidate}" if clean_path else candidate
            encoded_remote_path = GithubKitRepository._encode_path(remote_path)
            file_payload = GithubKitRepository._github_http_get(
                f"{GithubKitRepository._GITHUB_API_BASE}/repos/{owner}/{repository}/contents/{encoded_remote_path}",
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
                text = GithubKitRepository._decode_content(content, encoding)
            except ValueError:
                continue
            meta = GithubKitRepository._parse_manifest_content(text)
            if meta:
                return meta
        return {}

    @staticmethod
    def _github_skill_metadata(
        owner: str, repository: str, branch: str, kit_path: str
    ) -> Dict[str, str]:
        clean_path = kit_path.strip("/")
        for candidate in GithubKitRepository._SKILL_DESCRIPTOR_CANDIDATES:
            remote_path = f"{clean_path}/{candidate}" if clean_path else candidate
            encoded_remote_path = GithubKitRepository._encode_path(remote_path)
            file_payload = GithubKitRepository._github_http_get(
                f"{GithubKitRepository._GITHUB_API_BASE}/repos/{owner}/{repository}/contents/{encoded_remote_path}",
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
                text = GithubKitRepository._decode_content(content, encoding)
            except ValueError:
                continue

            descriptor_name: Optional[str] = None
            descriptor_description: Optional[str] = None
            if text.startswith("---\n"):
                closing_index = text.find("\n---", 4)
                if closing_index != -1:
                    frontmatter = text[4:closing_index]
                    try:
                        import yaml  # type: ignore

                        payload = yaml.safe_load(frontmatter) or {}
                        if isinstance(payload, dict):
                            normalized = {
                                str(key).strip().lower(): value
                                for key, value in payload.items()
                            }
                            descriptor_name = normalized.get("name")
                            descriptor_description = normalized.get("description")
                    except Exception:  # pragma: no cover
                        pass

            descriptor_format = (
                "skill"
                if candidate == SKILL_FILE_NAME
                else "innovation_kit"
            )
            metadata = {
                "id": descriptor_name,
                "name": descriptor_name,
                "description": descriptor_description,
                "descriptor_format": descriptor_format,
                "legacy_descriptor": descriptor_format == "innovation_kit",
            }
            return {key: value for key, value in metadata.items() if value is not None}
        return {}

    @staticmethod
    def _github_kit_metadata(
        owner: str, repository: str, branch: str, kit_path: str
    ) -> Dict[str, str]:
        manifest_meta = GithubKitRepository._github_manifest_metadata(owner, repository, branch, kit_path)
        skill_meta = GithubKitRepository._github_skill_metadata(owner, repository, branch, kit_path)
        metadata = {
            "id": manifest_meta.get("id") or skill_meta.get("id"),
            "name": manifest_meta.get("name") or skill_meta.get("name"),
            "version": manifest_meta.get("version") or "0.0.0",
            "description": manifest_meta.get("description") or skill_meta.get("description"),
            "display_name": manifest_meta.get("display_name"),
            "created_date": manifest_meta.get("created_date"),
            "last_updated": manifest_meta.get("last_updated"),
            "post_install_instructions": manifest_meta.get("post_install_instructions"),
            "descriptor_format": skill_meta.get("descriptor_format") or "none",
            "legacy_descriptor": bool(skill_meta.get("legacy_descriptor", False)),
        }
        return {key: value for key, value in metadata.items() if value is not None}

    @staticmethod
    def _decode_content_bytes(raw: str, encoding: str) -> bytes:
        if encoding == "base64":
            try:
                return base64.b64decode(raw)
            except Exception as exc:  # pragma: no cover
                raise ValueError("Failed to decode base64 content") from exc
        if encoding in {"", "utf-8", "none"}:
            return raw.encode("utf-8")
        raise ValueError(f"Unsupported content encoding: {encoding}")

    @staticmethod
    def _decode_content(raw: str, encoding: str) -> str:
        data = GithubKitRepository._decode_content_bytes(raw, encoding)
        try:
            return data.decode("utf-8")
        except Exception as exc:  # pragma: no cover
            raise ValueError("Failed to decode content as UTF-8") from exc

    @staticmethod
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

    @staticmethod
    def _github_token() -> Optional[str]:
        for env_name in GithubKitRepository._GITHUB_TOKEN_ENV_OPTIONS:
            token = os.getenv(env_name)
            if token:
                cleaned = token.strip()
                if cleaned:
                    return cleaned
        return None

    @staticmethod
    def _github_http_headers(accept: str, token: Optional[str]) -> Dict[str, str]:
        headers = {
            "Accept": accept,
            "User-Agent": "vibekit-cli",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    @staticmethod
    def _github_http_get(
        url: str,
        params: Optional[Dict[str, str]] = None,
        *,
        allow_404: bool = False,
        mode: Literal["json", "raw"] = "json",
    ):
        target = url
        if params:
            target = f"{target}?{urlencode(params)}"
        accept = "application/vnd.github.v3.raw" if mode == "raw" else "application/vnd.github.v3+json"
        token = GithubKitRepository._github_token()
        attempts = [token] if token else [None]
        if token:
            attempts.append(None)

        last_error: Exception | None = None
        for candidate_token in attempts:
            headers = GithubKitRepository._github_http_headers(accept, candidate_token)
            try:
                return GithubKitRepository._github_execute_request(target, headers, allow_404, mode)
            except Exception as exc:  # capture error and retry without token if possible
                last_error = exc
                if candidate_token is None:
                    break
                continue

        if last_error is not None:
            raise last_error
        return b"" if mode == "raw" else {}

    @staticmethod
    def _github_execute_request(
        target: str,
        headers: Dict[str, str],
        allow_404: bool,
        mode: Literal["json", "raw"],
    ):
        req = request.Request(target, headers=headers)
        try:
            with request.urlopen(req) as resp:
                raw = resp.read()
                if mode == "raw":
                    return raw
                charset = resp.headers.get_content_charset() or "utf-8"
                text = raw.decode(charset)
                if not text:
                    return {}
                return json.loads(text)
        except error.HTTPError as exc:
            if exc.code == 404 and allow_404:
                return None
            detail = exc.read().decode("utf-8", "ignore")
            message = GithubKitRepository._format_github_http_error(exc.code, detail)
            if exc.code in {401, 403, 404}:
                raise ValueError(message) from None
            raise RuntimeError(message) from None
        except error.URLError as exc:
            raise RuntimeError(f"Unable to reach GitHub (network error: {exc.reason})") from None

    @staticmethod
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
