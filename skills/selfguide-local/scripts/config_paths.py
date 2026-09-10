"""Prefer SelfGuide names while reusing existing login and pairing directories."""
import os
from pathlib import Path

def home(new_env, old_env, new_name, old_name):
    explicit = os.environ.get(new_env) or os.environ.get(old_env)
    if explicit:
        return Path(explicit).expanduser()
    base = Path.home() / '.local/share'
    new, old = base / new_name, base / old_name
    return new if new.exists() or not old.exists() else old

def browser_home():
    return home('SELFGUIDE_BROWSER_HOME', 'CHATGPT_BROWSER_HOME', 'selfguide-browser', 'codex-chatgpt-browser')

def local_home():
    return home('SELFGUIDE_LOCAL_HOME', 'ASTRA_LOCAL_HOME', 'selfguide-local-bridge', 'astra-local-bridge')

def project_file(base):
    current, legacy = base / 'run/selfguide-project.json', base / 'run/astra-project.json'
    return current if current.exists() or not legacy.exists() else legacy
