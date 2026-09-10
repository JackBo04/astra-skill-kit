#!/usr/bin/env python3
"""Configure or start a persistent ordinary Chrome desktop without replacing its login profile."""
import argparse
import http.client
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
from urllib.parse import urlsplit

from config_paths import browser_home, project_file

BASE = browser_home()
RUNTIME = Path(__file__).resolve().parents[1] / 'runtime/server-browser'
class Connection(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(5)
        self.sock.connect(str(BASE / 'run/control.sock'))

def status():
    c = Connection('localhost'); c.request('POST','/',json.dumps({'action':'status'}))
    response = c.getresponse()
    if response.status != 200: raise RuntimeError('Browser status failed.')
    return json.loads(response.read())

def main():
    os.umask(0o077)
    p=argparse.ArgumentParser(description=__doc__); sub=p.add_subparsers(dest='action',required=True)
    setup=sub.add_parser('setup'); setup.add_argument('--project-url',required=True)
    start=sub.add_parser('start'); start.add_argument('--allow-no-sandbox',action='store_true')
    sub.add_parser('status'); sub.add_parser('url')
    args=p.parse_args()
    if args.action=='setup':
        u=urlsplit(args.project_url)
        if u.scheme!='https' or u.netloc!='chatgpt.com' or u.query or u.fragment or not re.fullmatch(r'/g/g-p-[A-Za-z0-9]+(?:-[^/]+)?/project',u.path): raise ValueError('Use the ordinary selfguide project URL.')
        for d in ['run','logs','sysroot/usr/bin']:(BASE/d).mkdir(parents=True,exist_ok=True,mode=0o700)
        project=project_file(BASE)
        if project.exists():
            saved = urlsplit(json.loads(project.read_text())['url'])
            old_key = re.fullmatch(r'/g/(g-p-[A-Za-z0-9]+)(?:-[^/]+)?/project', saved.path)
            new_key = re.fullmatch(r'/g/(g-p-[A-Za-z0-9]+)(?:-[^/]+)?/project', u.path)
            if saved.scheme != 'https' or saved.netloc != 'chatgpt.com' or not old_key or old_key.group(1) != new_key.group(1):
                raise ValueError('Existing project differs. Do not overwrite it automatically.')
        if not project.exists(): project.write_text(json.dumps({'name':'selfguide','url':args.project_url},indent=2)+'\n')
        for name in ['xdotool','xclip','x11vnc']:
            target=BASE/'sysroot/usr/bin'/name
            if not target.exists():
                source=shutil.which(name)
                if not source: raise ValueError('Missing desktop dependency: '+name+'. Follow docs/server-browser.md.')
                target.symlink_to(source)
        print('Server browser configured; existing login profile preserved.')
    elif args.action=='status': print(json.dumps(status()))
    elif args.action=='url': print((BASE/'run/access-url.txt').read_text().strip())
    else:
        try:
            print(json.dumps({'already_running':True,'status':status()}));return
        except (OSError,RuntimeError): pass
        if not (project_file(BASE)).exists(): raise ValueError('Run setup first.')
        if not (RUNTIME/'node_modules').exists(): raise ValueError('Run npm ci inside the installed skill runtime/server-browser directory.')
        node=shutil.which('node')
        if not node: raise ValueError('Node.js is required.')
        chrome=(os.environ.get('SELFGUIDE_CHROME') or os.environ.get('ASTRA_CHROME')) or shutil.which('google-chrome') or '/opt/google/chrome/chrome'
        xvfb=(os.environ.get('SELFGUIDE_XVFB') or os.environ.get('ASTRA_XVFB')) or shutil.which('Xvfb')
        if not Path(chrome).exists() or not xvfb: raise ValueError('Chrome and Xvfb must be installed; see the server setup guide.')
        env={**os.environ,'SELFGUIDE_BROWSER_HOME':str(BASE),'SELFGUIDE_CHROME':chrome,'SELFGUIDE_XVFB':xvfb}
        if args.allow_no_sandbox: env['SELFGUIDE_ALLOW_NO_SANDBOX']='1'
        with (BASE/'logs/server.log').open('ab') as log:
            proc=subprocess.Popen([node,str(RUNTIME/'server.mjs')],env=env,cwd=RUNTIME,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
        print(json.dumps({'starting_pid':proc.pid,'next':'Check status and url. Login manually if the website asks.'}))

if __name__=='__main__': main()
