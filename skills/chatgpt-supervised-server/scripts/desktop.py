#!/usr/bin/env python3
"""Operate the existing server Chrome through its visible desktop, without a restart."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
from urllib.parse import urlsplit, urlunsplit
import uuid

BASE = Path(os.environ.get('CHATGPT_BROWSER_HOME', Path.home() / '.local/share/codex-chatgpt-browser'))

def environment():
    config = json.loads((BASE / 'run/config.json').read_text())
    return {**os.environ, 'DISPLAY': ':' + str(config['display']),
            'XAUTHORITY': str(BASE / 'run/Xauthority'),
            'LD_LIBRARY_PATH': ':'.join([str(BASE / 'sysroot/usr/lib/x86_64-linux-gnu'),
                                        str(BASE / 'sysroot/lib/x86_64-linux-gnu')])}

def xdo(*args):
    result = subprocess.run([str(BASE / 'sysroot/usr/bin/xdotool'), *map(str, args)],
                            env=environment(), capture_output=True, text=True, timeout=10)
    if result.returncode:
        raise RuntimeError('Desktop input failed; inspect the remote screen before retrying.')
    return result.stdout.strip()

def write_clipboard(text):
    proc = subprocess.Popen([str(BASE / 'sysroot/usr/bin/xclip'), '-selection', 'clipboard', '-in'],
                            env=environment(), stdin=subprocess.PIPE,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    proc.communicate(text.encode('utf-8'), timeout=10)
    if proc.returncode:
        raise RuntimeError('Could not write the desktop clipboard.')

def read_clipboard():
    result = subprocess.run([str(BASE / 'sysroot/usr/bin/xclip'), '-selection', 'clipboard', '-out'],
                            env=environment(), capture_output=True, timeout=5)
    if result.returncode:
        return ''
    return result.stdout.decode('utf-8', errors='replace')

def browser_window():
    matches = []
    profile_arg = '--user-data-dir=' + str(BASE / 'profile-manual')
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit():
            continue
        try:
            args = (entry / 'cmdline').read_bytes().decode(errors='replace').split('\0')
            if profile_arg in args and not any(arg.startswith('--type=') for arg in args):
                matches.append(int(entry.name))
        except (OSError, PermissionError):
            pass
    windows = []
    for pid in matches:
        try:
            windows.extend(xdo('search', '--onlyvisible', '--pid', pid).splitlines())
        except RuntimeError:
            pass
    windows = [window for window in windows if xdo('getwindowname', window)]
    active = xdo('getwindowfocus')
    if active in windows:
        return active
    if len(windows) != 1:
        raise RuntimeError(f'Expected one visible dedicated Chrome window; found {len(windows)}. Inspect the desktop.')
    xdo('windowfocus', '--sync', windows[0])
    return windows[0]

def current_url():
    browser_window()
    marker = 'URL_PENDING_' + uuid.uuid4().hex
    write_clipboard(marker)
    xdo('key', '--clearmodifiers', 'ctrl+l', 'ctrl+c')
    time.sleep(.2)
    value = read_clipboard().strip()
    xdo('key', 'Escape')
    write_clipboard('')
    parsed = urlsplit(value)
    if parsed.scheme not in {'https', 'http', 'chrome'}:
        raise RuntimeError('Could not read the browser address reliably.')
    # Authentication query strings may contain tokens. Never emit them.
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, '', ''))

def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    shot = sub.add_parser('screenshot'); shot.add_argument('--out', type=Path)
    sub.add_parser('url')
    go = sub.add_parser('goto'); go.add_argument('url')
    click = sub.add_parser('click'); click.add_argument('x', type=int); click.add_argument('y', type=int)
    key = sub.add_parser('key'); key.add_argument('keys', nargs='+')
    paste = sub.add_parser('paste'); paste.add_argument('--file', type=Path, required=True); paste.add_argument('--expect-url')
    paste.add_argument('--x', type=int); paste.add_argument('--y', type=int)
    attach = sub.add_parser('attach'); attach.add_argument('--file', type=Path, required=True)
    attach.add_argument('--expect-url', required=True)
    attach.add_argument('--x', type=int, required=True); attach.add_argument('--y', type=int, required=True)
    copy = sub.add_parser('copy-reply'); copy.add_argument('x', type=int); copy.add_argument('y', type=int)
    copy.add_argument('--out', type=Path, required=True); copy.add_argument('--expect-url', required=True)
    args = parser.parse_args()
    with (BASE / 'run/desktop.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if args.action == 'screenshot':
            from PIL import ImageGrab
            os.environ['XAUTHORITY'] = environment()['XAUTHORITY']
            output = args.out or BASE / 'run/desktop-current.png'
            output.parent.mkdir(parents=True, exist_ok=True)
            image = ImageGrab.grab(xdisplay=environment()['DISPLAY'])
            image.save(output)
            print(json.dumps({'path': str(output.resolve()), 'size': image.size}))
            return
        if args.action == 'url':
            print(current_url()); return
        browser_window()
        if args.action == 'goto':
            url = urlsplit(args.url)
            if url.scheme != 'https' or url.netloc != 'chatgpt.com' or url.query or url.fragment:
                raise RuntimeError('Use a normal ChatGPT project or conversation URL, without authentication parameters.')
            write_clipboard(args.url)
            xdo('key', '--clearmodifiers', 'ctrl+l', 'ctrl+v', 'Return')
            time.sleep(.15)
            write_clipboard('')
        elif args.action == 'click':
            xdo('mousemove', args.x, args.y, 'click', 1)
        elif args.action == 'key':
            xdo('key', '--clearmodifiers', *args.keys)
        elif args.action == 'attach':
            selected = args.file.resolve(strict=True)
            if not selected.is_file():
                raise RuntimeError('Select one regular file, not a directory.')
            parsed = urlsplit(args.expect_url)
            if parsed.scheme != 'https' or parsed.netloc != 'chatgpt.com' or not parsed.path.startswith('/g/'):
                raise RuntimeError('Attach only in the expected ChatGPT project or task conversation.')
            if current_url() != args.expect_url:
                raise RuntimeError('Wrong page; no file was attached.')
            xdo('mousemove', args.x, args.y, 'click', 1)
            proc = subprocess.Popen([str(BASE / 'sysroot/usr/bin/xclip'), '-selection', 'clipboard',
                                     '-t', 'text/uri-list', '-in'], env=environment(), stdin=subprocess.PIPE,
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                proc.communicate((selected.as_uri() + '\r\n').encode('utf-8'), timeout=10)
                if proc.returncode:
                    raise RuntimeError('Could not copy the selected file.')
                xdo('key', '--clearmodifiers', 'ctrl+v')
                time.sleep(2)
            finally:
                write_clipboard('')
            print(json.dumps({'file': str(selected), 'paste_requested': True, 'submitted': False,
                              'next': 'Inspect the attachment card and wait for upload completion before sending.'}))
            return
        elif args.action == 'paste':
            if args.expect_url and (args.x is None or args.y is None):
                raise RuntimeError('When checking the URL, provide --x and --y for the input observed in the latest screenshot.')
            if args.expect_url and current_url() != args.expect_url:
                raise RuntimeError('The browser is no longer in the expected conversation; no text was pasted.')
            text = args.file.read_text()
            if not text or len(text.encode()) > 65536:
                raise RuntimeError('Use a nonempty UTF-8 message of at most 64 KB.')
            if args.x is not None and args.y is not None:
                xdo('mousemove', args.x, args.y, 'click', 1)
            write_clipboard(text)
            xdo('key', '--clearmodifiers', 'ctrl+v')
            time.sleep(.15)
            write_clipboard('')
            print(json.dumps({'pasted': True, 'sha256': hashlib.sha256(text.encode()).hexdigest(), 'submitted': False}))
            return
        elif args.action == 'copy-reply':
            if current_url() != args.expect_url:
                raise RuntimeError('Wrong conversation; nothing copied.')
            marker = 'COPY_PENDING_' + uuid.uuid4().hex
            write_clipboard(marker)
            xdo('mousemove', args.x, args.y, 'click', 1)
            deadline = time.monotonic() + 5
            text = marker
            while time.monotonic() < deadline:
                text = read_clipboard()
                if text and text != marker:
                    break
                time.sleep(.2)
            if not text or text == marker:
                raise RuntimeError('The reply copy button was not confirmed. Take a fresh screenshot and retry copying, not sending.')
            args.out.parent.mkdir(parents=True, exist_ok=True)
            args.out.write_text(text)
            write_clipboard('')
            print(json.dumps({'path': str(args.out.resolve()), 'characters': len(text), 'sha256': hashlib.sha256(text.encode()).hexdigest()}))
            return
        print(json.dumps({'ok': True}))

if __name__ == '__main__':
    main()
