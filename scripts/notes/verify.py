import json,re,os
notes=json.load(open('notes.json'))
src={}
for f in ['out/sources.json','out/sources2.json','out/sources3.json']:
  if os.path.exists(f): src.update(json.load(open(f)))
bytext={}
for k,v in src.items():
  for p in v['pages']: bytext[p['url']]=p['text']
bad=0
for csc,n in notes.items():
  if not n: continue
  text=' '.join(bytext.get(u,'') for u in n['sources'])
  nums=re.findall(r'\d[\d.,]*',n['text'])
  missing=[x.rstrip('.,') for x in nums if x.rstrip('.,') not in text and x.rstrip('.,').replace(',','') not in text]
  if missing: bad+=1; print(csc, missing, '|', n['text'][:110])
print('flagged',bad)
