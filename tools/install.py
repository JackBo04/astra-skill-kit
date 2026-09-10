#!/usr/bin/env python3
"""Install either packaged skill on the Codex execution server."""
import argparse
from pathlib import Path
import shutil

root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('variant',choices=['server','local'])
p.add_argument('--skills-dir',type=Path,default=Path.home()/'.agents/skills')
a=p.parse_args()
name='chatgpt-supervised-'+a.variant
source=root/'skills'/name; target=a.skills_dir.expanduser()/name
if target.exists() or target.is_symlink(): p.error('Destination already exists; review the update before replacing it: '+str(target))
target.parent.mkdir(parents=True,exist_ok=True)
shutil.copytree(source,target,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
if a.variant=='server':
 shutil.copytree(root/'runtime/server-browser',target/'runtime/server-browser',ignore=shutil.ignore_patterns('node_modules'))
print('Installed '+str(target.resolve()))
print('Start a new Codex conversation and invoke $'+name+'.')
