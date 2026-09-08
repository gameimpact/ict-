const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__dirname,dir=process.env.DATA_DIR||path.join(root,'data');fs.mkdirSync(dir,{recursive:true});
const questions=JSON.parse(fs.readFileSync(path.join(root,'questions.json'),'utf8')),byId=new Map(questions.map(q=>[q.id,q]));
const file=path.join(dir,'progress.json');let db=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{users:[1,2,3].map(id=>({id,name:`用户${id}`,attempts:[],favorites:[],lastId:null}))};
function save(){fs.writeFileSync(file+'.tmp',JSON.stringify(db));fs.renameSync(file+'.tmp',file)}
function send(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj))}
const normalize=s=>String(s).normalize('NFKC').toLowerCase().replace(/[\s;；,，。]/g,'');
const server=http.createServer(async(req,res)=>{try{
const u=new URL(req.url,'http://localhost');
if(u.pathname==='/api/health')return send(res,200,{ok:true,questions:questions.length});
if(u.pathname==='/api/questions')return send(res,200,questions);
if(u.pathname==='/api/users')return send(res,200,db.users.map(({id,name})=>({id,name})));
if(u.pathname.startsWith('/api/')){
 const user=db.users.find(x=>x.id===Number(req.headers['x-user-id']));if(!user)return send(res,400,{error:'请选择用户'});
 if(req.method==='GET'&&u.pathname==='/api/progress')return send(res,200,user);
 if(req.method==='POST'){
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return send(res,403,{error:'来源不匹配'});
  let body='';for await(const chunk of req){body+=chunk;if(body.length>20000)return send(res,413,{error:'请求过大'})}let b=JSON.parse(body||'{}');
  if(u.pathname==='/api/name'){if(typeof b.name!=='string'||!b.name.trim()||b.name.length>24)return send(res,400,{error:'昵称需为1到24个字符'});user.name=b.name.trim();save();return send(res,200,user)}
  const q=byId.get(b.id);if(!q)return send(res,400,{error:'题目不存在'});
  if(u.pathname==='/api/favorite'){const s=new Set(user.favorites);b.value?s.add(q.id):s.delete(q.id);user.favorites=[...s];save();return send(res,200,user)}
  if(u.pathname==='/api/position'){user.lastId=q.id;save();return send(res,200,{ok:true})}
  if(u.pathname==='/api/answer'){
   let correct=null,answer=b.answer;
   if(q.gradable){
    if(q.options.length){if(!Array.isArray(answer)||!answer.length||answer.some(x=>!q.options.find(o=>o.key===x)))return send(res,400,{error:'请先选择答案'});correct=[...new Set(answer)].sort().join('')===q.answer.split('').sort().join('')}
    else{if(typeof answer!=='string'||!answer.trim()||answer.length>2000)return send(res,400,{error:'请先填写答案'});correct=(q.acceptedAnswers||[q.answer]).some(a=>normalize(a)===normalize(answer))}
   }else{if(typeof b.selfCorrect!=='boolean')return send(res,400,{error:'请对照参考答案自评'});correct=b.selfCorrect;answer='自评'}
   if(typeof b.attemptId!=='string'||b.attemptId.length>80)return send(res,400,{error:'无效提交'});
   const existing=user.attempts.find(a=>a.attemptId===b.attemptId);if(existing)return send(res,200,{result:existing,progress:user});
   const result={id:q.id,answer,correct,selfAssessed:!q.gradable,at:new Date().toISOString(),attemptId:b.attemptId};user.attempts.push(result);user.lastId=q.id;save();return send(res,200,{result,progress:user})
  }
 }
 return send(res,404,{error:'接口不存在'});
}
if(req.method!=='GET')return send(res,405,{error:'Method not allowed'});
let p=decodeURIComponent(u.pathname);if(p==='/')p='/index.html';const target=path.resolve(root,'static','.'+p),staticRoot=path.resolve(root,'static')+path.sep;if(!target.startsWith(staticRoot))return send(res,403,{error:'Forbidden'});
if(!fs.existsSync(target)||!fs.statSync(target).isFile())return send(res,404,{error:'Not found'});
res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg'})[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});fs.createReadStream(target).pipe(res);
}catch(e){console.error(e.message);if(!res.headersSent)send(res,500,{error:'操作失败，请重试'});else res.end()}});
server.listen(Number(process.env.PORT||6400),'0.0.0.0',()=>console.log('ICT practice listening'));
