const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
// A same-origin gateway forwards only the caller's credential and these two operations.
export const onRequest: PagesFunction = async ({request,params}) => {
 const operation=params.operation;
 const path=operation==='students' && request.method==='GET'?'/api/students':operation==='words' && request.method==='POST'?'/api/words/add-batch':null;
 if(!path)return json({error:'不支持的联动操作'},404);
 const origin=request.headers.get('Origin');
 if(origin && origin!==new URL(request.url).origin)return json({error:'请求来源无效'},403);
 const key=request.headers.get('X-Admin-Key');
 if(!key)return json({error:'请先填写 Encounter 密钥'},401);
 try {
  let body:string|undefined;
  if(request.method==='POST'){
   if(Number(request.headers.get('Content-Length'))>1000000)return json({error:'推送内容过大'},413);
   body=await request.text();if(body.length>1000000)return json({error:'推送内容过大'},413);
   let payload;try{payload=JSON.parse(body);}catch{return json({error:'推送内容格式无效'},400);}
   if(!Number.isSafeInteger(payload.student_id) || payload.student_id<1 || !Array.isArray(payload.words) || !payload.words.length || payload.words.length>1000)return json({error:'学生或词汇格式无效'},400);
  }
  const response=await fetch('https://encounter-backend.100170403natasha.workers.dev'+path,{method:request.method,headers:{'Content-Type':'application/json','X-Admin-Key':key},body,signal:AbortSignal.timeout(20000)});
  let result;try{result=await response.json() as Record<string,unknown>;}catch{return json({error:'Encounter 返回格式异常'},502);}
  if(!response.ok || result.error)return json({error:response.status===401 || response.status===403?'Encounter 密钥无效或没有权限':'Encounter 暂时不可用，请重试'},response.status===401 || response.status===403?401:502);
  if(operation==='students' && !Array.isArray(result.students))return json({error:'Encounter 学生列表格式异常'},502);
  return json(result);
 }catch{return json({error:'连接 Encounter 失败，请检查网络后重试'},502);}
};
