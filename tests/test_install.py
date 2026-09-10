import subprocess
import sys
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

class InstallTest(unittest.TestCase):
    def run_install(self, root, variant, *extra, ok=True):
        result = subprocess.run([sys.executable, str(ROOT/'tools/install.py'), variant,
                                 '--skills-dir', str(root/'skills'), '--backup-dir', str(root/'backups'), *extra],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode == 0, ok, result.stdout+result.stderr)
        return result.stdout

    def test_reinstall_and_backup_update_for_both_variants(self):
        for variant in ['server', 'local']:
            with self.subTest(variant=variant), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                self.run_install(root, variant)
                target = root/'skills'/('selfguide-'+variant)
                original = (target/'SKILL.md').read_text()
                self.assertIn('Already up to date', self.run_install(root, variant))
                self.assertFalse((root/'backups').exists())
                (target/'personal-notes.txt').write_text('Keep my local settings')
                (target/'SKILL.md').write_text(original+'\nPersonal customization\n')
                if variant == 'server':
                    dependency = target/'runtime/server-browser/node_modules/custom-dependency'
                    dependency.mkdir(parents=True)
                    (dependency/'preserve.txt').write_text('installed dependency')
                self.run_install(root, variant, ok=False)
                self.assertIn('Personal customization', (target/'SKILL.md').read_text())
                self.run_install(root, variant, '--update')
                self.assertEqual((target/'SKILL.md').read_text(), original)
                self.assertEqual((target/'personal-notes.txt').read_text(), 'Keep my local settings')
                backups = list((root/'backups').iterdir())
                self.assertEqual(len(backups), 1)
                self.assertIn('Personal customization', (backups[0]/'SKILL.md').read_text())
                if variant == 'server':
                    self.assertEqual((dependency/'preserve.txt').read_text(), 'installed dependency')
                self.assertIn('Already up to date', self.run_install(root, variant, '--update'))
                self.assertEqual(len(list((root/'backups').iterdir())), 1)

    def test_original_name_and_symlink_target_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.run_install(root, 'server', '--name', 'selfguide')
            link = root/'skills/selfguide'
            actual = root/'actual-skill'
            link.rename(actual)
            link.symlink_to(actual, target_is_directory=True)
            (actual/'SKILL.md').write_text('old customized version')
            self.run_install(root, 'server', '--name', 'selfguide', '--update')
            self.assertTrue(link.is_symlink())
            self.assertEqual(link.resolve(), actual)
            self.assertIn('name: selfguide\n', (actual/'SKILL.md').read_text())
            self.assertFalse((root/'skills/selfguide-server').exists())
            self.assertIn('Already up to date', self.run_install(root, 'server', '--name', 'selfguide', '--update'))

    def test_directory_conflict_keeps_original_installation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.run_install(root, 'local')
            target = root/'skills/selfguide-local'
            original = (target/'SKILL.md').read_bytes()
            (target/'SKILL.md').unlink()
            (target/'SKILL.md').mkdir()
            (target/'SKILL.md/user-file').write_bytes(original)
            self.run_install(root, 'local', '--update', ok=False)
            self.assertEqual((target/'SKILL.md/user-file').read_bytes(), original)
            self.assertTrue((target/'scripts/bridge.py').exists())

if __name__ == '__main__':
    unittest.main()
