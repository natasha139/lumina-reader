import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/encounter/[operation]';
const call=(operation:string,method='GET',key='test-key',body?:unknown,origin?:string)=>onRequest({params:{operation},request:new Request('https://lumina.test/api/encounter/'+operation,{method,headers:{...(key?{'X-Admin-Key':key}:{}),...(origin?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})})} as any);
test('gateway only allows its two operations, rejects missing credentials and cross-origin requests',async()=>{
 assert.equal((await call('students','GET','')).status,401);
 assert.equal((await call('students','GET','test',undefined,'https://other.test')).status,403);
 assert.equal((await call('delete','DELETE')).status,404);
 assert.equal((await call('words','POST','test',{student_id:1,words:[]})).status,400);
});
test('gateway preserves caller auth and zero added count; upstream errors never become success',async()=>{
 const original=globalThis.fetch;let opts:RequestInit|undefined;
 try{
  globalThis.fetch=async(_url,options)=>{opts=options;return Response.json({added:0,skipped:2});};
  const response=await call('words','POST','test-key',{student_id:1,words:['word']});
  assert.equal(response.status,200);assert.equal((await response.json()).added,0);assert.equal((opts!.headers as any)['X-Admin-Key'],'test-key');
  globalThis.fetch=async()=>Response.json({error:'private'}, {status:401});assert.equal((await call('students')).status,401);
  globalThis.fetch=async()=>Response.json({error:'private'}, {status:500});assert.equal((await call('students')).status,502);
  globalThis.fetch=async()=>new Response('bad');assert.equal((await call('students')).status,502);
  globalThis.fetch=async()=>Response.json({students:{}});assert.equal((await call('students')).status,502);
  globalThis.fetch=async()=>{throw Error('offline');};assert.equal((await call('students')).status,502);
 }finally{globalThis.fetch=original;}
});
