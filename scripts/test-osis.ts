import { parseRef } from '../src/lib/osis';
for (const r of ['Rom 3:21-28','Romans 3.21','1 Cor 13','I Corinthians 13:4','Phil 2:5-11','Phlm 4','Rom 3:21-4:5','Isaiah 53','Song of Solomon 2:1','Ps 23'])
  console.log(r.padEnd(22), JSON.stringify(parseRef(r)));
