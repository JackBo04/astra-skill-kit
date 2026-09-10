import importlib.util
import os
import json
import subprocess
import sys
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]

class ConfigPathsTest(unittest.TestCase):
    def test_setup_accepts_renamed_project_but_preserves_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            (base/'run').mkdir()
            bin_path = base/'sysroot/usr/bin'
            bin_path.mkdir(parents=True)
            for name in ['xdotool', 'xclip', 'x11vnc']:
                (bin_path/name).touch()
            config = base/'run/selfguide-project.json'
            original = json.dumps({'name': 'selfguide', 'url': 'https://chatgpt.com/g/g-p-test-astra/project'})
            config.write_text(original)
            command = [sys.executable, str(ROOT/'skills/selfguide-server/scripts/browserctl.py'), 'setup', '--project-url']
            env = {**os.environ, 'SELFGUIDE_BROWSER_HOME': str(base)}
            result = subprocess.run(command+['https://chatgpt.com/g/g-p-test-selfguide/project'], env=env, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            result = subprocess.run(command+['https://chatgpt.com/g/g-p-other-selfguide/project'], env=env, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(config.read_text(), original)

    def test_existing_data_and_explicit_settings_survive_rename(self):
        for variant in ['server', 'local']:
            with self.subTest(variant=variant), tempfile.TemporaryDirectory() as directory:
                spec = importlib.util.spec_from_file_location('paths_'+variant, ROOT/f'skills/selfguide-{variant}/scripts/config_paths.py')
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                root = Path(directory)
                with patch.object(module.Path, 'home', return_value=root), patch.dict(os.environ, {}, clear=True):
                    for function, new_name, old_name, new_env, old_env in [
                        (module.browser_home, 'selfguide-browser', 'codex-chatgpt-browser', 'SELFGUIDE_BROWSER_HOME', 'CHATGPT_BROWSER_HOME'),
                        (module.local_home, 'selfguide-local-bridge', 'astra-local-bridge', 'SELFGUIDE_LOCAL_HOME', 'ASTRA_LOCAL_HOME'),
                    ]:
                        old = root/'.local/share'/old_name
                        new = root/'.local/share'/new_name
                        self.assertEqual(function(), new)
                        old.mkdir(parents=True)
                        (old/'existing-data').write_text('preserve')
                        self.assertEqual(function(), old)
                        new.symlink_to(old, target_is_directory=True)
                        self.assertEqual(function(), new)
                        self.assertEqual((function()/'existing-data').read_text(), 'preserve')
                        with patch.dict(os.environ, {old_env: str(root/'custom-old')}):
                            self.assertEqual(function(), root/'custom-old')
                            with patch.dict(os.environ, {new_env: str(root/'custom-new')}):
                                self.assertEqual(function(), root/'custom-new')
                    base = root/'browser'
                    (base/'run').mkdir(parents=True)
                    old = base/'run/astra-project.json'
                    new = base/'run/selfguide-project.json'
                    self.assertEqual(module.project_file(base), new)
                    old.write_text('{}')
                    self.assertEqual(module.project_file(base), old)
                    new.write_text('{}')
                    self.assertEqual(module.project_file(base), new)

if __name__ == '__main__':
    unittest.main()
