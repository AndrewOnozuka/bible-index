import { parseRef } from '../src/lib/osis';
for (const r of ['Jude 3','Jude 1:3','Phlm 4-6','3 John 4','Obad 15'])
  console.log(r.padEnd(12), JSON.stringify(parseRef(r)));
