#!/usr/bin/env python3
"""Record handoffs before browser actions so uncertain sends are never retried blindly."""
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
from urllib.parse import urlsplit
import uuid

BASE = Path(os.environ.get('CHATGPT_BROWSER_HOME', Path.home() / '.local/share/codex-chatgpt-browser'))

def now():
    return datetime.now(timezone.utc).isoformat()

def save(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)

def text_file(path):
    text = path.read_text()
    if not text.strip():
        raise ValueError('The message or note cannot be empty.')
    return text

def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    new = sub.add_parser('new'); new.add_argument('--task-file', type=Path, required=True)
    new.add_argument('--workspace', type=Path, default=Path.cwd() / 'astra')
    for action in ['stage', 'prepare', 'submitting', 'sent', 'reply', 'checkpoint', 'resume', 'status']:
        item = sub.add_parser(action); item.add_argument('--run', type=Path, required=True)
        if action in ['stage', 'prepare', 'reply']:
            item.add_argument('--file', type=Path, required=True)
        if action == 'sent':
            item.add_argument('--url', required=True)
        if action == 'checkpoint':
            item.add_argument('--phase', choices=['executing', 'waiting_user', 'paused', 'complete'], required=True)
            item.add_argument('--note-file', type=Path, required=True)
    args = parser.parse_args()
    if args.action == 'new':
        bridge_base = Path(os.environ.get('ASTRA_LOCAL_HOME', Path.home() / '.local/share/astra-local-bridge'))
        bridge_config = json.loads((bridge_base / 'config.json').read_text())
        project = {'name': 'astra', 'url': bridge_config['project_url']}
        if project['name'] != 'astra':
            raise ValueError('All new conversations must belong to astra.')
        task = text_file(args.task_file)
        run = args.workspace.resolve() / 'tasks' / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8])
        run.mkdir(parents=True, mode=0o700)
        for directory in ['uploads', 'messages', 'feedback', 'outputs', 'checks']:
            (run / directory).mkdir(mode=0o700)
        (run / 'task.txt').write_text(task)
        state = {'id': run.name, 'project_name': 'astra', 'project_url': project['url'],
                 'conversation_url': None, 'phase': 'ready', 'round': 0, 'rounds': [],
                 'created_at': now(), 'events': [], 'layout_version': 2}
        save(run / 'state.json', state)
        print(json.dumps({'run': str(run), 'project_url': project['url']}))
        return
    run = args.run.resolve()
    with (run / '.state.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        path = run / 'state.json'
        state = json.loads(path.read_text())
        result = {'run': str(run)}
        if args.action == 'status':
            print(json.dumps(state, ensure_ascii=False, indent=2)); return
        if state['phase'] == 'complete':
            raise ValueError('This task is complete; create a new task record for new work.')
        if args.action == 'stage':
            if state['phase'] not in ['ready', 'executing']:
                raise ValueError('Stage attachments before preparing the next message.')
            source = args.file.resolve(strict=True)
            if not source.is_file() or source.name == 'manifest.json':
                raise ValueError('Select one regular file with a nonreserved filename.')
            uploads = run / 'uploads'
            uploads.mkdir(exist_ok=True, mode=0o700)
            target = uploads / source.name
            if target.exists():
                raise ValueError('An attachment with this name already exists; use a distinct filename.')
            with source.open('rb') as incoming, target.open('xb') as outgoing:
                shutil.copyfileobj(incoming, outgoing)
            digest = hashlib.sha256()
            with target.open('rb') as staged:
                for chunk in iter(lambda: staged.read(1024 * 1024), b''):
                    digest.update(chunk)
            manifest_path = uploads / 'manifest.json'
            manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {'files': []}
            manifest['files'].append({'name': target.name, 'source': str(source),
                                      'bytes': target.stat().st_size, 'sha256': digest.hexdigest(),
                                      'status': 'staged', 'staged_at': now()})
            save(manifest_path, manifest)
            result['file'] = str(target)
        elif args.action == 'prepare':
            if state['phase'] not in ['ready', 'executing']:
                raise ValueError('Resolve the previous handoff first; do not duplicate an uncertain send.')
            text = text_file(args.file)
            if len(text.encode()) > 65536:
                raise ValueError('Split this message into task-relevant portions of at most 64 KB.')
            state['round'] += 1
            name = ('messages/' if state.get('layout_version', 1) >= 2 else '') + f"out-{state['round']:03}.txt"
            (run / name).write_text(text)
            state['rounds'].append({'number': state['round'], 'outgoing': name,
                                    'outgoing_sha256': hashlib.sha256(text.encode()).hexdigest()})
            state['phase'] = 'prepared'
            result['file'] = str(run / name)
        elif args.action == 'submitting':
            if state['phase'] != 'prepared':
                raise ValueError('Only a prepared message can be marked for submission.')
            state['phase'] = 'send_pending'
        elif args.action == 'sent':
            if state['phase'] != 'send_pending':
                raise ValueError('Confirm the pending browser submission first.')
            parsed = urlsplit(args.url)
            project_key = urlsplit(state['project_url']).path.split('/')[2]
            if (parsed.scheme != 'https' or parsed.netloc != 'chatgpt.com' or parsed.query or parsed.fragment
                    or not re.fullmatch('/g/' + re.escape(project_key) + r'(?:-[^/]+)?/c/[A-Za-z0-9-]+', parsed.path)):
                raise ValueError('The conversation URL must be inside the configured astra project.')
            if state['conversation_url'] and state['conversation_url'] != args.url:
                raise ValueError('Continue in the original task conversation.')
            state['conversation_url'] = args.url
            state['rounds'][-1]['sent_at'] = now()
            state['phase'] = 'waiting_reply'
        elif args.action == 'reply':
            if state['phase'] != 'waiting_reply':
                raise ValueError('Record a confirmed send before accepting its reply.')
            text = text_file(args.file)
            name = ('feedback/' if state.get('layout_version', 1) >= 2 else '') + f"in-{state['round']:03}.txt"
            (run / name).write_text(text)
            state['rounds'][-1].update({'incoming': name, 'incoming_sha256': hashlib.sha256(text.encode()).hexdigest(),
                                        'received_at': now()})
            state['phase'] = 'executing'
            result['file'] = str(run / name)
        elif args.action == 'checkpoint':
            if args.phase in ['executing', 'complete'] and state['phase'] != 'executing':
                raise ValueError('Do not bypass an unresolved handoff; confirm and read the reply first.')
            note = text_file(args.note_file)
            name = ('checks/' if state.get('layout_version', 1) >= 2 else '') + f"note-{len(state['events']) + 1:03}.txt"
            (run / name).write_text(note)
            if args.phase in ['paused', 'waiting_user'] and state['phase'] not in ['paused', 'waiting_user']:
                state['resume_phase'] = state['phase']
            state['phase'] = args.phase
            state['latest_note'] = name
        elif args.action == 'resume':
            if state['phase'] not in ['paused', 'waiting_user'] or 'resume_phase' not in state:
                raise ValueError('Only a paused task can be resumed.')
            state['phase'] = state.pop('resume_phase')
        state['updated_at'] = now()
        state['events'].append({'at': state['updated_at'], 'action': args.action, 'phase': state['phase'], 'round': state['round']})
        save(path, state)
        result['phase'] = state['phase']
        print(json.dumps(result))

if __name__ == '__main__':
    main()
