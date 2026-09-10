import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
class SessionTest(unittest.TestCase):
 def test_both_variants_keep_evidence_and_send_guards(self):
  for variant in ['server','local']:
   with self.subTest(variant=variant), tempfile.TemporaryDirectory() as d:
    root=Path(d);(root/'browser/run').mkdir(parents=True);(root/'bridge').mkdir()
    project='https://chatgpt.com/g/g-p-test/project'
    (root/'browser/run/astra-project.json').write_text(json.dumps({'name':'astra','url':project}))
    (root/'bridge/config.json').write_text(json.dumps({'project_url':project}))
    env={**os.environ,'CHATGPT_BROWSER_HOME':str(root/'browser'),'ASTRA_LOCAL_HOME':str(root/'bridge')}
    script=ROOT/f'skills/chatgpt-supervised-{variant}/scripts/session.py'
    task=root/'task.txt';task.write_text('Synthetic task')
    source=root/'data.txt';source.write_bytes(b'original evidence')
    def call(*args,ok=True):
     result=subprocess.run([sys.executable,str(script),*map(str,args)],capture_output=True,text=True,env=env)
     self.assertEqual(result.returncode==0,ok,result.stderr)
     return json.loads(result.stdout) if ok else None
    run=Path(call('new','--task-file',task,'--workspace',root/'astra')['run'])
    for name in ['uploads','messages','feedback','outputs','checks']:self.assertTrue((run/name).is_dir())
    call('stage','--run',run,'--file',source)
    item=json.loads((run/'uploads/manifest.json').read_text())['files'][0]
    self.assertEqual(item['sha256'],hashlib.sha256(source.read_bytes()).hexdigest())
    call('stage','--run',run,'--file',source,ok=False)
    call('prepare','--run',run,'--file',task);call('submitting','--run',run)
    call('prepare','--run',run,'--file',task,ok=False)
    call('sent','--run',run,'--url','https://chatgpt.com/c/wrong',ok=False)
    call('checkpoint','--run',run,'--phase','paused','--note-file',task)
    call('resume','--run',run);self.assertEqual(call('status','--run',run)['phase'],'send_pending')
    call('sent','--run',run,'--url','https://chatgpt.com/g/g-p-test-astra/c/123')
    call('reply','--run',run,'--file',task)
    self.assertTrue((run/'feedback/in-001.txt').exists())
    call('checkpoint','--run',run,'--phase','complete','--note-file',task)
    call('prepare','--run',run,'--file',task,ok=False)

if __name__=='__main__':unittest.main()
