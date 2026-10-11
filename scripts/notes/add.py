import json,sys,os
# usage: python3 add.py <<< 'csc|text|src idx list' lines  (idx refer to sources.json pages)
src=json.load(open('out/sources.json'))
for f in ['out/sources2.json','out/sources3.json']:
  if os.path.exists(f): src.update(json.load(open(f)))
p='notes.json'; notes=json.load(open(p)) if os.path.exists(p) else {}
for line in sys.stdin.read().strip().split('\n'):
  if not line.strip(): continue
  csc,text,idx=[x.strip() for x in line.split('|')]
  if text=='-': notes[csc]=None; continue
  urls=[i if i.startswith('http') else src[csc]['pages'][int(i)]['url'] for i in idx.split(',') if i!='']
  notes[csc]={'text':text,'sources':urls}
json.dump(notes,open(p,'w'),indent=1,ensure_ascii=False)
print(len(notes),'notes;',sum(1 for v in notes.values() if v),'written')
