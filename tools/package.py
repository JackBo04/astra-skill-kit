#!/usr/bin/env python3
"""Build two source-only install bundles from an explicit directory allowlist."""
from pathlib import Path
import hashlib
import json
import zipfile
root=Path(__file__).resolve().parents[1]
out=root/'dist';out.mkdir(exist_ok=True)
manifest={}
for variant in ['server','local']:
 name='selfguide-'+variant+'-browser-v0.2.1'
 sources=[root/'README.md',root/'LICENSE',root/'docs',root/'tools/install.py',root/'skills'/('chatgpt-supervised-'+variant)]
 sources.append(root/'runtime/server-browser' if variant=='server' else root/'extension')
 paths=set()
 for source in sources:
  for f in (source.rglob('*') if source.is_dir() else [source]):
   if f.is_file() and not any(x in f.parts for x in ['node_modules','__pycache__']) and f.suffix!='.pyc':paths.add(f)
 archive=out/(name+'.zip')
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
  for f in sorted(paths):z.write(f,name+'/'+str(f.relative_to(root)))
 manifest[archive.name]={'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':len(paths)}
(out/'SHA256SUMS').write_text(''.join(v['sha256']+'  '+k+'\n' for k,v in manifest.items()))
print(json.dumps(manifest,indent=2))
