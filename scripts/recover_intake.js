#!/usr/bin/env node
// Read-only recovery. Existing Blob credential stays in the process environment.
// Never opens material URLs, creates issues, deletes files, or publishes a course.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { get } = require('@vercel/blob');
async function readPrivate(pathname) {
  const result = await get(pathname, { access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN });
  if (!result || result.statusCode !== 200 || !result.stream) throw Error('private file unavailable');
  const chunks=[];let size=0;
  for await(const chunk of result.stream){size+=chunk.length;if(size>4*1024*1024)throw Error('recovery size limit');chunks.push(Buffer.from(chunk));}
  return Buffer.concat(chunks);
}
async function main(){
  const [receipt,output]=process.argv.slice(2);
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(receipt||'')||!output)throw Error('usage');
  if(!process.env.BLOB_READ_WRITE_TOKEN)throw Error('credential required');
  const prefix=`curriculum/${receipt}/`;
  const raw=await readPrivate(prefix+'receipt.json');
  const record=JSON.parse(raw.toString('utf8'));
  if(record.schemaVersion!==1||record.receipt!==receipt||!Array.isArray(record.files)||record.files.length>3)throw Error('invalid receipt');
  const recovered=[];
  for(const file of record.files){
    if(typeof file.pathname!=='string'||!file.pathname.startsWith(prefix)||file.pathname.includes('..')||!/^([a-f0-9]{64})$/.test(file.sha256))throw Error('invalid file record');
    const bytes=await readPrivate(file.pathname);
    if(bytes.length!==file.size||crypto.createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('file integrity mismatch');
    recovered.push(bytes);
  }
  const dest=path.resolve(output);await fs.mkdir(dest,{mode:0o700});
  await fs.writeFile(path.join(dest,'receipt.json'),raw,{mode:0o600,flag:'wx'});
  for(let i=0;i<recovered.length;i++)await fs.writeFile(path.join(dest,`attachment-${i+1}.bin`),recovered[i],{mode:0o600,flag:'wx'});
  console.log(`Recovered ${recovered.length} private file(s); checksums verified. Local output is confidential. No issue or course was published.`);
}
main().catch(()=>{console.error('Recovery failed. Verify receipt, Blob access, checksums and a new output directory. No completion is claimed.');process.exitCode=1;});
