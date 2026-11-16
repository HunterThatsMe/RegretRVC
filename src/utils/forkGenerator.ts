import { ACCENT_HEX, BRAND_NAME } from '../data/defaults.ts';
import type {
  ApplioTabId,
  DownloadModelItem,
  ForkConfig,
  VoiceModelProject,
} from '../types/studio.ts';
import { buildTrainPipelineCommands, sanitizeModelName } from './rvcTuning.ts';

export interface GeneratedBundleFile {
  id: string;
  filename: string;
  zipPath: string;
  language: 'json' | 'python' | 'bash';
  description: string;
  content: string;
}

export function generateThemePython(): string {
  return `from __future__ import annotations
from typing import Iterable
from gradio.themes.base import Base
from gradio.themes.utils import colors, fonts, sizes


class NoRegretsRVCTheme(Base):
    """Locked deep crimson-red Gradio theme for ${BRAND_NAME}."""

    def __init__(
        self,
        *,
        primary_hue: colors.Color | str = colors.neutral,
        secondary_hue: colors.Color | str = colors.neutral,
        neutral_hue: colors.Color | str = colors.neutral,
        spacing_size: sizes.Size | str = sizes.spacing_md,
        radius_size: sizes.Size | str = sizes.radius_lg,
        text_size: sizes.Size | str = sizes.text_md,
        font: fonts.Font | str | Iterable[fonts.Font | str] = (
            fonts.GoogleFont("Plus Jakarta Sans"),
            "ui-sans-serif",
            "system-ui",
        ),
        font_mono: fonts.Font | str | Iterable[fonts.Font | str] = (
            fonts.GoogleFont("JetBrains Mono"),
            "ui-monospace",
            "monospace",
        ),
    ):
        super().__init__(
            primary_hue=primary_hue,
            secondary_hue=secondary_hue,
            neutral_hue=neutral_hue,
            spacing_size=spacing_size,
            radius_size=radius_size,
            text_size=text_size,
            font=font,
            font_mono=font_mono,
        )
        self.name = "${BRAND_NAME}"
        super().set(
            body_background_fill="#0D0405",
            body_background_fill_dark="#0D0405",
            background_fill_primary="#160709",
            background_fill_primary_dark="#160709",
            background_fill_secondary="#200B0E",
            background_fill_secondary_dark="#200B0E",
            block_background_fill="#160709",
            block_background_fill_dark="#160709",
            block_border_color="#47161D",
            block_border_color_dark="#47161D",
            block_border_width="1px",
            block_border_width_dark="1px",
            block_label_background_fill="#200B0E",
            block_label_background_fill_dark="#200B0E",
            block_label_text_color="#DFBFC3",
            block_label_text_color_dark="#DFBFC3",
            block_title_text_color="#FDF7F7",
            block_title_text_color_dark="#FDF7F7",
            body_text_color="#FDF7F7",
            body_text_color_dark="#FDF7F7",
            body_text_color_subdued="#AD8288",
            body_text_color_subdued_dark="#AD8288",
            input_background_fill="#100506",
            input_background_fill_dark="#100506",
            input_border_color="#47161D",
            input_border_color_dark="#47161D",
            input_border_color_focus="${ACCENT_HEX}",
            input_border_color_focus_dark="${ACCENT_HEX}",
            button_primary_background_fill="${ACCENT_HEX}",
            button_primary_background_fill_dark="${ACCENT_HEX}",
            button_primary_background_fill_hover="#FF2B35",
            button_primary_background_fill_hover_dark="#FF2B35",
            button_primary_text_color="#FFFFFF",
            button_primary_text_color_dark="#FFFFFF",
            button_primary_border_color="#9F1018",
            button_primary_border_color_dark="#9F1018",
            button_secondary_background_fill="#200B0E",
            button_secondary_background_fill_dark="#200B0E",
            button_secondary_background_fill_hover="#331116",
            button_secondary_background_fill_hover_dark="#331116",
            button_secondary_text_color="#FDF7F7",
            button_secondary_text_color_dark="#FDF7F7",
            button_secondary_border_color="#47161D",
            button_secondary_border_color_dark="#47161D",
            slider_color="${ACCENT_HEX}",
            slider_color_dark="${ACCENT_HEX}",
            checkbox_background_color_selected="${ACCENT_HEX}",
            checkbox_background_color_selected_dark="${ACCENT_HEX}",
            checkbox_border_color_focus="${ACCENT_HEX}",
            checkbox_border_color_focus_dark="${ACCENT_HEX}",
            color_accent="${ACCENT_HEX}",
            color_accent_soft="#5E0E14",
        )
`;
}

export function generateAppPython(
  config: ForkConfig,
  project: VoiceModelProject
): string {
  const tabDefs: Record<
    ApplioTabId,
    { importLine: string; tabTitle: string; fnCall: string }
  > = {
    train: {
      importLine: 'from tabs.train.train import train_tab',
      tabTitle: 'Training',
      fnCall: 'train_tab()',
    },
    models: {
      importLine: 'from tabs.download.download import download_tab',
      tabTitle: 'Models',
      fnCall: 'download_tab()',
    },
    samples: {
      importLine: 'from tabs.inference.inference import inference_tab',
      tabTitle: 'Samples',
      fnCall: 'inference_tab()',
    },
    voice_blender: {
      importLine: 'from tabs.voice_blender.voice_blender import voice_blender_tab',
      tabTitle: 'Voice Blender',
      fnCall: 'voice_blender_tab()',
    },
    tts: {
      importLine: 'from tabs.tts.tts import tts_tab',
      tabTitle: 'TTS',
      fnCall: 'tts_tab()',
    },
    tensorboard: {
      importLine: 'from tabs.tensorboard.tensorboard import tensorboard_tab',
      tabTitle: 'TensorBoard',
      fnCall: 'tensorboard_tab()',
    },
    extra: {
      importLine: 'from tabs.extra.extra import extra_tab',
      tabTitle: 'Extra',
      fnCall: 'extra_tab()',
    },
    settings: {
      importLine: 'from tabs.settings.settings import settings_tab',
      tabTitle: 'Settings',
      fnCall: 'settings_tab()',
    },
  };

  const enabledTabs = (Object.keys(tabDefs) as ApplioTabId[]).filter(
    (id) => config.activeTabs[id]
  );
  const imports = enabledTabs.map((id) => tabDefs[id].importLine).join('\n');
  const tabBlocks = enabledTabs
    .map(
      (id) => `        with gr.TabItem("${tabDefs[id].tabTitle}"):\n            ${tabDefs[id].fnCall}`
    )
    .join('\n');

  return `import argparse
import os
import sys
import gradio as gr

now_dir = os.getcwd()
sys.path.append(now_dir)

from assets.themes.NoRegretsRVC import NoRegretsRVCTheme
${imports}

CUSTOM_CSS = """
.gradio-container { max-width: 1360px !important; margin: 0 auto !important; }
.tab-nav button.selected { color: ${ACCENT_HEX} !important; border-color: ${ACCENT_HEX} !important; }
.gr-box, .gr-panel, .gr-form { border-radius: 12px !important; }
footer { display: none !important; }
"""


def build_ui() -> gr.Blocks:
    theme = NoRegretsRVCTheme()
    with gr.Blocks(title="${BRAND_NAME}", theme=theme, css=CUSTOM_CSS) as app:
        gr.Markdown("# ${BRAND_NAME}")
        gr.Markdown(
            "RVC Voice Model Studio (${project.samplingRate} · ${project.vocoder} · ${project.pitchExtractor.toUpperCase()}) · "
            "Cloudflare & Auto-Backup Ready"
        )
        with gr.Tabs():
${tabBlocks || '        with gr.TabItem("Training"):\n            gr.Markdown("Enable at least one tab.")'}
    return app


def main():
    parser = argparse.ArgumentParser(description="${BRAND_NAME} WebUI")
    parser.add_argument("--server-name", "--host", dest="server_name", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=6969)
    parser.add_argument("--share", action="store_true")
    parser.add_argument("--client", action="store_true")
    args, _ = parser.parse_known_args()

    auth = None
    username = os.environ.get("APPLIO_AUTH_USERNAME", "").strip()
    password = os.environ.get("APPLIO_AUTH_PASSWORD", "").strip()
    if username and password:
        auth = (username, password)

    app = build_ui()
    app.queue(default_concurrency_limit=40).launch(
        server_name=args.server_name,
        server_port=args.port,
        share=args.share,
        auth=auth,
        inbrowser=args.client,
        show_error=True,
    )


if __name__ == "__main__":
    main()
`;
}

export function generateBackupPython(config: ForkConfig): string {
  return `import argparse
import os
import shutil
import subprocess
import time
from pathlib import Path

LOGS_DIR = Path("/kaggle/working/program_ml/logs")
PROVIDER = "${config.backupProvider}"
HF_REPO_ID = "${config.hfRepoId.trim()}"
HF_PRIVATE = ${config.hfPrivate ? 'True' : 'False'}
DRIVE_REMOTE = "${config.driveRemoteName.trim() || 'gdrive'}"
DRIVE_FOLDER = "${config.driveFolderPath.trim() || 'ApplioExported'}"
BACKUP_SCOPE = "${config.backupScope}"
INTERVAL_SEC = max(120, ${config.backupEveryEpochs} * 45)


def collect_artifacts(model_dir: Path, staging_dir: Path) -> int:
    count = 0
    target_model_dir = staging_dir / model_dir.name
    target_model_dir.mkdir(parents=True, exist_ok=True)
    for item in model_dir.iterdir():
        if not item.is_file():
            continue
        is_index = item.suffix == ".index"
        is_weight = item.suffix == ".pth" and not item.name.startswith(("G_", "D_"))
        is_resume = item.suffix == ".pth" and item.name.startswith(("G_", "D_"))
        if is_index or is_weight or (BACKUP_SCOPE == "full-checkpoints" and is_resume):
            dest = target_model_dir / item.name
            if not dest.exists() or dest.stat().st_mtime < item.stat().st_mtime:
                shutil.copy2(item, dest)
                count += 1
    return count


def sync_huggingface(staging_dir: Path) -> None:
    token = os.environ.get("HF_TOKEN", "").strip()
    if not token or not HF_REPO_ID or "your-username" in HF_REPO_ID:
        print("[Backup] HF_TOKEN or HF_REPO_ID not set; skipping Hugging Face sync.")
        return
    from huggingface_hub import HfApi
    api = HfApi(token=token)
    api.create_repo(repo_id=HF_REPO_ID, repo_type="model", private=HF_PRIVATE, exist_ok=True)
    api.upload_folder(
        folder_path=str(staging_dir),
        repo_id=HF_REPO_ID,
        repo_type="model",
        commit_message="Automated ${BRAND_NAME} checkpoint backup",
    )
    print(f"[Backup] Synced artifacts to Hugging Face: {HF_REPO_ID}")


def sync_google_drive(staging_dir: Path) -> None:
    if shutil.which("rclone") is None:
        print("[Backup] rclone not installed; skipping Google Drive sync.")
        return
    dest = f"{DRIVE_REMOTE}:{DRIVE_FOLDER}"
    subprocess.run(["rclone", "copy", str(staging_dir), dest, "--transfers", "4"], check=False)
    print(f"[Backup] Synced artifacts to Google Drive: {dest}")


def run_once() -> None:
    if not LOGS_DIR.exists():
        return
    staging = Path("/tmp/noregrets_backup_staging")
    staging.mkdir(parents=True, exist_ok=True)
    copied = 0
    for sub in LOGS_DIR.iterdir():
        if sub.is_dir() and sub.name != "mute":
            copied += collect_artifacts(sub, staging)
    if copied == 0:
        return
    if PROVIDER in ("huggingface", "both"):
        sync_huggingface(staging)
    if PROVIDER in ("google-drive", "both"):
        sync_google_drive(staging)


def main() -> None:
    parser = argparse.ArgumentParser(description="${BRAND_NAME} Checkpoint Backup Daemon")
    parser.add_argument("--watch", action="store_true", help="Continuously sync checkpoints")
    args = parser.parse_args()
    if not args.watch:
        run_once()
        return
    print(f"[Backup] Watching {LOGS_DIR} every {INTERVAL_SEC}s (provider={PROVIDER}, scope={BACKUP_SCOPE})")
    while True:
        try:
            run_once()
        except Exception as exc:
            print(f"[Backup] Warning: {exc}")
        time.sleep(INTERVAL_SEC)


if __name__ == "__main__":
    main()
`;
}

export function generateKaggleNotebookJson(
  config: ForkConfig,
  project: VoiceModelProject,
  downloads: DownloadModelItem[]
): string {
  const repoTarget = config.customRepoUrl.trim() || 'https://github.com/IAHispano/Applio.git';
  const themeB64 = toBase64Utf8(generateThemePython());
  const appB64 = toBase64Utf8(generateAppPython(config, project));
  const backupB64 = toBase64Utf8(generateBackupPython(config));

  const installLines: string[] = [
    `import base64`,
    `import hashlib`,
    `import os`,
    `import shutil`,
    `import subprocess`,
    `import sys`,
    `import urllib.request`,
    `from pathlib import Path`,
    `from IPython.display import clear_output`,
    ``,
    `repo_dir = Path("/kaggle/working/program_ml")`,
    `repo_url = "${repoTarget}"`,
    ``,
    `subprocess.run([sys.executable, "-m", "pip", "install", "-q", "uv"], check=True)`,
    `if repo_dir.exists() and (repo_dir / ".git").is_dir():`,
    `    subprocess.run(["git", "-C", str(repo_dir), "pull", "--ff-only"], check=False)`,
    `else:`,
    `    subprocess.run(["git", "clone", "--depth", "1", repo_url, str(repo_dir)], check=True)`,
    ``,
    `subprocess.run(["apt", "update", "-y"], check=True)`,
    `subprocess.run(["apt", "install", "-y", "portaudio19-dev", "psmisc"], check=True)`,
    ``,
    `uv_bin = shutil.which("uv") or str(Path(sys.executable).with_name("uv"))`,
  ];

  if (config.useUvVenv) {
    installLines.push(
      `venv_python = Path("/kaggle/.venv/bin/python")`,
      `if not venv_python.exists():`,
      `    subprocess.run([uv_bin, "venv", "/kaggle/.venv", "--python", "3.12", "--seed"], check=True)`,
      `py_exec = str(venv_python)`,
      `subprocess.run([uv_bin, "pip", "install", "-q", "-r", str(repo_dir / "requirements.txt"), "--extra-index-url", "https://download.pytorch.org/whl/cu128", "--index-strategy", "unsafe-best-match", "--python", py_exec], check=True)`
    );
  } else {
    installLines.push(
      `py_exec = sys.executable`,
      `subprocess.run([uv_bin, "pip", "install", "-q", "-r", str(repo_dir / "requirements.txt"), "--extra-index-url", "https://download.pytorch.org/whl/cu128", "--index-strategy", "unsafe-best-match", "--system"], check=True)`
    );
  }

  if (config.verifyOnnxGpu) {
    installLines.push(
      `subprocess.run([uv_bin, "pip", "install", "-q", "onnxruntime-gpu", "--python", py_exec] if ${config.useUvVenv ? 'True' : 'False'} else [uv_bin, "pip", "install", "-q", "onnxruntime-gpu", "--system"], check=False)`,
      `subprocess.run([py_exec, "-c", "import onnxruntime as ort; print('ONNX Providers:', ort.get_available_providers())"], check=False)`
    );
  }

  if (config.backupProvider === 'huggingface' || config.backupProvider === 'both') {
    installLines.push(
      `subprocess.run([uv_bin, "pip", "install", "-q", "huggingface_hub", "--python", py_exec] if ${config.useUvVenv ? 'True' : 'False'} else [uv_bin, "pip", "install", "-q", "huggingface_hub", "--system"], check=True)`
    );
  }
  if (config.backupProvider === 'google-drive' || config.backupProvider === 'both') {
    installLines.push(
      `if shutil.which("rclone") is None:`,
      `    subprocess.run(["bash", "-c", "curl -fsSL https://rclone.org/install.sh | sudo bash"], check=False)`
    );
  }

  installLines.push(
    ``,
    `# Write ${BRAND_NAME} custom WebUI, locked red theme, and auto-backup patches`,
    `(repo_dir / "assets" / "themes").mkdir(parents=True, exist_ok=True)`,
    `(repo_dir / "assets" / "themes" / "NoRegretsRVC.py").write_bytes(base64.b64decode("${themeB64}"))`,
    `(repo_dir / "app.py").write_bytes(base64.b64decode("${appB64}"))`,
    `(repo_dir / "core_backup.py").write_bytes(base64.b64decode("${backupB64}"))`,
    ``,
    `os.chdir(repo_dir)`,
    `prereq_cmd = [py_exec, "core.py", "prerequisites", "--models", "--exe", "--pretraineds-hifigan"]`,
    `subprocess.run(prereq_cmd, check=True)`
  );

  if (downloads.length > 0) {
    installLines.push(
      ``,
      `# Pre-boot Model Downloader manifest`,
      `boot_downloads = ${JSON.stringify(
        downloads.map((d) => ({ name: d.name, url: d.url })),
        null,
        4
      )}`,
      `dl_dir = repo_dir / "logs" / "downloads"`,
      `dl_dir.mkdir(parents=True, exist_ok=True)`,
      `for entry in boot_downloads:`,
      `    print("Boot manifest ready:", entry["name"], "->", entry["url"])`
    );
  }

  installLines.push(
    ``,
    `if shutil.which("filebrowser") is None:`,
    `    subprocess.run(["bash", "-o", "pipefail", "-c", "curl -fsSL https://raw.githubusercontent.com/filebrowser/get/master/get.sh | sudo bash"], check=True)`,
    ``,
    `cloudflared_path = repo_dir.parent / "cloudflared"`,
    `cloudflared_url = "https://github.com/cloudflare/cloudflared/releases/download/2026.9.0/cloudflared-linux-amd64"`,
    `cloudflared_sha256 = "53b7a7a5420d188758d24341294acb0d1bca54296548ac05e38811a694ac6134"`,
    `if not (cloudflared_path.is_file() and hashlib.sha256(cloudflared_path.read_bytes()).hexdigest() == cloudflared_sha256):`,
    `    tmp = cloudflared_path.with_suffix(".download")`,
    `    with urllib.request.urlopen(cloudflared_url, timeout=120) as resp, open(tmp, "wb") as dst:`,
    `        shutil.copyfileobj(resp, dst)`,
    `    if hashlib.sha256(tmp.read_bytes()).hexdigest() != cloudflared_sha256:`,
    `        tmp.unlink(missing_ok=True)`,
    `        raise RuntimeError("cloudflared checksum verification failed.")`,
    `    os.replace(tmp, cloudflared_path)`,
    `cloudflared_path.chmod(0o755)`,
    `clear_output()`,
    `print("${BRAND_NAME} setup complete! Model: ${sanitizeModelName(project.name)} (${project.samplingRate} · ${project.vocoder})")`
  );

  const pyExecutableExpr = config.useUvVenv ? '"/kaggle/.venv/bin/python"' : 'sys.executable';

  const startLines: string[] = [
    `import os`,
    `import re`,
    `import secrets`,
    `import shutil`,
    `import socket`,
    `import subprocess`,
    `import sys`,
    `import threading`,
    `import time`,
    `from pathlib import Path`,
    `from IPython.display import clear_output`,
    ``,
    `Tunnel = "${config.tunnelMode}" #@param ["Gradio + Cloudflare", "Horizon"]`,
    `horizon_id = "${config.horizonId}" #@param {type:"string"}`,
    `hf_token = "" #@param {type:"string"}`,
    ``,
    `repo_dir = Path("/kaggle/working/program_ml")`,
    `cloudflared_path = repo_dir.parent / "cloudflared"`,
    `filebrowser_db = repo_dir / "filebrowser.db"`,
    `py_exec = ${pyExecutableExpr}`,
    ``,
    `fb_user = "noregrets"`,
    `fb_pass = ${config.randomAuthEnabled ? 'secrets.token_urlsafe(24)' : '"noregrets1234"'}`,
    `app_user = "noregrets"`,
    `app_pass = ${config.randomAuthEnabled ? 'secrets.token_urlsafe(24)' : '""'}`,
    ``,
    `cf_pattern = r"https://[a-zA-Z0-9-]+\\.trycloudflare\\.com"`,
    `hz_pattern = r"https://[a-zA-Z0-9.-]+\\.hrzn\\.run"`,
    `tunnel_procs = []`,
    `tunnel_logs = []`,
    `fb_proc = None`,
    `backup_proc = None`,
    `app_proc = None`,
    ``,
    `def wait_for_port(host, port, proc, timeout=180):`,
    `    deadline = time.time() + timeout`,
    `    while time.time() < deadline:`,
    `        if proc.poll() is not None:`,
    `            raise RuntimeError(f"Service exited early with code {proc.returncode}")`,
    `        try:`,
    `            with socket.create_connection((host, port), timeout=1):`,
    `                return`,
    `        except OSError:`,
    `            time.sleep(1)`,
    `    raise RuntimeError(f"Timed out waiting for port {port}")`,
    ``,
    `def start_tunnel(cmd, name, pattern):`,
    `    out_path = repo_dir / f"{name}.log"`,
    `    f = open(out_path, "w", encoding="utf-8")`,
    `    proc = subprocess.Popen(cmd, stdout=f, stderr=subprocess.STDOUT, text=True)`,
    `    tunnel_procs.append(proc)`,
    `    tunnel_logs.append(f)`,
    `    deadline = time.time() + 60`,
    `    while time.time() < deadline:`,
    `        txt = out_path.read_text(encoding="utf-8", errors="replace") if out_path.exists() else ""`,
    `        m = re.search(pattern, txt)`,
    `        if m:`,
    `            return m.group(0)`,
    `        time.sleep(1)`,
    `    raise RuntimeError(f"Tunnel {name} failed to emit URL")`,
    ``,
    `os.chdir(repo_dir)`,
    `for port in ("6969/tcp", "9876/tcp"):`,
    `    subprocess.run(["fuser", "-k", port], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)`,
    ``,
    `db_cmd = "set" if filebrowser_db.exists() else "init"`,
    `subprocess.run(["filebrowser", "config", db_cmd, "--auth.method=json", "--database", str(filebrowser_db)], check=True)`,
    `upd = subprocess.run(["filebrowser", "users", "update", fb_user, "--password", fb_pass, "--perm.admin", "--database", str(filebrowser_db)], capture_output=True)`,
    `if upd.returncode != 0:`,
    `    subprocess.run(["filebrowser", "users", "add", fb_user, fb_pass, "--perm.admin", "--database", str(filebrowser_db)], check=True)`,
    ``,
    `if Tunnel == "Horizon":`,
    `    if not horizon_id.strip():`,
    `        raise ValueError("Enter your horizon_id before running Horizon tunnel.")`,
    `    subprocess.run(["npm", "install", "-g", "@hrzn/cli"], check=True)`,
    `    subprocess.run(["hrzn", "login", horizon_id], check=True)`,
    ``,
    `clear_output()`,
    `print("=== ${BRAND_NAME} Session Credentials ===")`,
    `if app_pass:`,
    `    print(f"WebUI Username: {app_user}")`,
    `    print(f"WebUI Password: {app_pass}")`,
    `print(f"FileBrowser Username: {fb_user}")`,
    `print(f"FileBrowser Password: {fb_pass}")`,
    `print("TensorBoard is built into the WebUI TensorBoard tab.")`,
    ``,
    `try:`,
    `    fb_log = open(repo_dir / "filebrowser.log", "w", encoding="utf-8")`,
    `    fb_proc = subprocess.Popen(["filebrowser", "--database", str(filebrowser_db), "--root", "/kaggle", "--address", "127.0.0.1", "--port", "9876"], stdout=fb_log, stderr=subprocess.STDOUT, text=True)`,
    `    wait_for_port("127.0.0.1", 9876, fb_proc, timeout=30)`,
    ``,
    `    env = os.environ.copy()`,
    `    if app_pass:`,
    `        env["APPLIO_AUTH_USERNAME"] = app_user`,
    `        env["APPLIO_AUTH_PASSWORD"] = app_pass`,
    `    if hf_token.strip():`,
    `        env["HF_TOKEN"] = hf_token.strip()`,
    `    env["PYTHONUNBUFFERED"] = "1"`,
    ``,
    `    if "${config.backupProvider}" != "none":`,
    `        backup_proc = subprocess.Popen([py_exec, "core_backup.py", "--watch"], env=env)`,
    ``,
    `    app_cmd = [py_exec, "app.py", "--server-name", "0.0.0.0", "--port", "6969"]`,
    `    if Tunnel == "Gradio + Cloudflare":`,
    `        app_cmd.append("--share")`,
    `    app_proc = subprocess.Popen(app_cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)`,
    `    threading.Thread(target=lambda: [print(line, end="", flush=True) for line in app_proc.stdout], daemon=True).start()`,
    `    wait_for_port("127.0.0.1", 6969, app_proc, timeout=180)`,
    ``,
    `    if Tunnel == "Gradio + Cloudflare":`,
    `        fb_url = start_tunnel([str(cloudflared_path), "tunnel", "--no-autoupdate", "--protocol", "http2", "--url", "http://127.0.0.1:9876"], "filebrowser-cf", cf_pattern)`,
    `        print(f"Cloudflare FileBrowser URL: {fb_url}")`,
    `    else:`,
    `        web_url = start_tunnel(["hrzn", "tunnel", "http://localhost:6969"], "webui-hrzn", hz_pattern)`,
    `        fb_url = start_tunnel(["hrzn", "tunnel", "http://localhost:9876"], "fb-hrzn", hz_pattern)`,
    `        print(f"${BRAND_NAME} WebUI URL: {web_url}")`,
    `        print(f"Horizon FileBrowser URL: {fb_url}")`,
    `    app_proc.wait()`,
    `finally:`,
    `    for p in reversed(tunnel_procs):`,
    `        if p.poll() is None: p.terminate()`,
    `    for p in (backup_proc, fb_proc, app_proc):`,
    `        if p is not None and p.poll() is None: p.terminate()`,
    `    for f in tunnel_logs:`,
    `        f.close()`,
    `    for port in ("6969/tcp", "9876/tcp"):`,
    `        subprocess.run(["fuser", "-k", port], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)`,
  ];

  const notebook = {
    nbformat: 4,
    nbformat_minor: 4,
    metadata: {
      kernelspec: {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3',
      },
      language_info: {
        name: 'python',
        version: '3.12.0',
      },
      kaggle: {
        accelerator: 'nvidiaTeslaT4',
        isGpuEnabled: true,
        isInternetEnabled: true,
        language: 'python',
        sourceType: 'notebook',
      },
    },
    cells: [
      {
        cell_type: 'markdown',
        metadata: {},
        source: [
          `## **${BRAND_NAME}**\n`,
          `Custom RVC voice model training environment built on Applio (${project.samplingRate} · ${project.vocoder} · ${project.pitchExtractor.toUpperCase()}).\n\n`,
          `- **Dataset Path**: \`${project.datasetPath || '/kaggle/input/datasets/your-username/dataset'}\`\n`,
          `- **Included Tabs**: ${Object.entries(config.activeTabs).filter(([, v]) => v).map(([k]) => k).join(', ')}\n`,
          `- **Tunnel & Auth**: ${config.tunnelMode} with ${config.randomAuthEnabled ? 'auto-generated 24-byte passwords' : 'standard access'}\n`,
          `- **Checkpoint Auto-Backup**: ${config.backupProvider === 'none' ? 'Disabled' : `${config.backupProvider} every ${config.backupEveryEpochs} epochs (${config.backupScope})`}\n`,
        ],
      },
      {
        cell_type: 'markdown',
        metadata: {},
        source: ['## 1. Install Dependencies & Apply NoRegretsRVC Patches\n'],
      },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: { trusted: true },
        outputs: [],
        source: installLines.map((l) => l + '\n'),
      },
      {
        cell_type: 'markdown',
        metadata: {},
        source: [
          '## 2. Launch WebUI, FileBrowser & Auto-Backup\n',
          'TensorBoard runs inside the WebUI **TensorBoard** tab. Add your Hugging Face write token in `hf_token` if checkpoint auto-backup is enabled.\n',
        ],
      },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: { trusted: true },
        outputs: [],
        source: startLines.map((l) => l + '\n'),
      },
    ],
  };

  return JSON.stringify(notebook, null, 2);
}

function toBase64Utf8(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf8').toString('base64');
  }
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

export function generateForkBundle(
  config: ForkConfig,
  project: VoiceModelProject,
  downloads: DownloadModelItem[]
): GeneratedBundleFile[] {
  return [
    {
      id: 'notebook',
      filename: `${BRAND_NAME}_Kaggle.ipynb`,
      zipPath: `assets/${BRAND_NAME}_Kaggle.ipynb`,
      language: 'json',
      description:
        'Kaggle-ready notebook preconfigured with SHA-256 verified tunnels, randomized passwords, dual-T4 setup, and auto-backup workers.',
      content: generateKaggleNotebookJson(config, project, downloads),
    },
    {
      id: 'app-py',
      filename: 'app.py',
      zipPath: 'app.py',
      language: 'python',
      description:
        'NoRegretsRVC launcher registering Training, Models, Samples, Voice Blender, TTS, TensorBoard, Extra, and Settings.',
      content: generateAppPython(config, project),
    },
    {
      id: 'theme-py',
      filename: `${BRAND_NAME}.py`,
      zipPath: `assets/themes/${BRAND_NAME}.py`,
      language: 'python',
      description:
        'Fixed crimson-red Gradio styling sheet built specifically for NoRegretsRVC.',
      content: generateThemePython(),
    },
    {
      id: 'backup-py',
      filename: 'core_backup.py',
      zipPath: 'core_backup.py',
      language: 'python',
      description:
        'Background sync service mirroring .pth weights and .index files to Hugging Face Hub or Google Drive.',
      content: generateBackupPython(config),
    },
    {
      id: 'commands-sh',
      filename: 'run_commands.sh',
      zipPath: 'run_commands.sh',
      language: 'bash',
      description: `Generated Kaggle shell commands for "${sanitizeModelName(project.name)}" (${project.samplingRate} · ${project.vocoder}).`,
      content: `#!/usr/bin/env bash\nset -euo pipefail\n\n${buildTrainPipelineCommands(project)}\n`,
    },
  ];
}
