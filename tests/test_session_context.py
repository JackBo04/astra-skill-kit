"""Recovery should not load an accumulating audit history into the caller."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class CompactSessionTest(unittest.TestCase):
    def test_bounded_output_preserves_recovery_and_full_history(self):
        for variant in ['server', 'local']:
            with self.subTest(variant=variant), tempfile.TemporaryDirectory() as directory:
                run = Path(directory)
                path = run / 'state.json'
                current = {'number': 7, 'outgoing': 'messages/out-007.txt',
                           'incoming': 'feedback/in-007.txt', 'incoming_source': 'dom',
                           'reply_format_valid': False, 'format_review_note': 'large review ' * 10000}
                state = {'id': 'test', 'project_url': 'https://chatgpt.com/g/g-p-test/project',
                         'conversation_url': 'https://chatgpt.com/g/g-p-test/c/test',
                         'phase': 'paused', 'resume_phase': 'executing', 'round': 7,
                         'latest_note': 'checks/note-023.txt', 'rounds': [current], 'events': []}
                script = ROOT / f'skills/selfguide-{variant}/scripts/session.py'

                def status(brief):
                    result = subprocess.run([sys.executable, str(script), 'status', '--run', str(run),
                                             *(['--brief'] if brief else [])],
                                            capture_output=True, text=True, check=True)
                    return result.stdout

                path.write_text(json.dumps(state))
                small = status(True)
                self.assertLess(len(small.encode()), 1500)
                summary = json.loads(small)
                self.assertEqual(summary['resume_phase'], 'executing')
                self.assertEqual(summary['current']['incoming'], current['incoming'])
                self.assertEqual(summary['current']['outgoing'], current['outgoing'])
                self.assertFalse(summary['current']['reply_format_valid'])
                self.assertEqual(summary['latest_note'], state['latest_note'])
                # Add a long audit trail: current status must remain exactly the same.
                state['rounds'] = [{'number': n, 'format_review_note': 'historical detail ' * 100}
                                   for n in range(6)] + [current]
                state['events'] = [{'note': 'historical detail ' * 100} for _ in range(1000)]
                path.write_text(json.dumps(state))
                original = path.read_bytes()
                self.assertEqual(status(True), small)
                self.assertEqual(json.loads(status(False)), state)
                self.assertEqual(path.read_bytes(), original)
                # Newly created and legacy tasks may have no current handoff.
                state = {'id': 'empty', 'phase': 'ready', 'round': 0, 'rounds': []}
                path.write_text(json.dumps(state))
                self.assertIsNone(json.loads(status(True))['current'])


if __name__ == '__main__':
    unittest.main()
