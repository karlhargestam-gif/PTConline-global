const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
const source = fs.readFileSync('scripts/recover_intake.js','utf8');
const receipt='12345678-1234-4123-8123-123456789abc';
async function run({corrupt=false,outside=false,missing=false}={}) {
  const data=Buffer.from('SYNTHETIC private file');
  const pathname=outside?'curriculum/other/file.txt':`curriculum/${receipt}/file.txt`;
  const record={schemaVersion:1,receipt,payload:{email:'synthetic@example.invalid'},files:[{pathname,sha256:crypto.createHash('sha256').update(data).digest('hex'),size:data.length}]};
  const writes=[],gets=[],errors=[],messages=[];
  const fakeFs={mkdir:async(p,o)=>writes.push({mkdir:p,mode:o.mode}),writeFile:async(p,b,o)=>writes.push({path:p,bytes:b,mode:o.mode,flag:o.flag})};
  const fakeBlob={get:async(p,opts)=>{gets.push({p,opts});if(missing)return null;const bytes=p.endsWith('receipt.json')?Buffer.from(JSON.stringify(record)):(corrupt?Buffer.from('corrupt'):data);return {statusCode:200,stream:(async function*(){yield bytes})()}}};
  const process={argv:['node','script',receipt,'/synthetic-recovery-output'],env:{BLOB_READ_WRITE_TOKEN:'synthetic-secret'}};
  const sandbox={require:n=>n==='node:fs/promises'?fakeFs:n==='@vercel/blob'?fakeBlob:require(n),Buffer,process,console:{error:m=>errors.push(m),log:m=>messages.push(m)}};
  await vm.runInNewContext(source,sandbox);
  return {writes,gets,errors,messages,process};
}
test('restore requires private reads, validates bytes, and writes restricted local files',async()=>{const r=await run();assert.equal(r.errors.length,0);assert.equal(r.gets.length,2);assert.ok(r.gets.every(x=>x.opts.access==='private'));assert.equal(r.writes[0].mode,0o700);assert.ok(r.writes.slice(1).every(x=>x.mode===0o600&&x.flag==='wx'));assert.doesNotMatch(r.messages.join(),/synthetic@example/)});
test('checksum mismatch fails before writing output',async()=>{const r=await run({corrupt:true});assert.equal(r.process.exitCode,1);assert.equal(r.writes.length,0)});
test('receipt cannot redirect reads to another submission',async()=>{const r=await run({outside:true});assert.equal(r.process.exitCode,1);assert.equal(r.gets.length,1);assert.equal(r.writes.length,0)});
test('missing private record fails without exposing secrets or claiming success',async()=>{const r=await run({missing:true});assert.equal(r.process.exitCode,1);assert.equal(r.messages.length,0);assert.doesNotMatch(r.errors.join(),/synthetic-secret/)});
