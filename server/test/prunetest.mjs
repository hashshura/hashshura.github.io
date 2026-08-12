import { Lobby } from '../src/lobby.js';
class Res { constructor(b,i={}){ this.body=b; this.status=i.status||200; } async json(){ return JSON.parse(this.body); } }
class Req { constructor(u,i={}){ this.url=u; this.method=i.method||'GET'; this._b=i.body; this.cf={colo:'SIN'}; }
  get headers(){ return {get:()=>null}; } async json(){ return JSON.parse(this._b); } }
globalThis.Response = Res;
const st = () => { const m=new Map(); return {storage:{async get(k){return m.get(k);},async put(k,v){m.set(k,v);},async delete(k){m.delete(k);}}}; };
const env = { ROOM: { idFromName:(n)=>n, get:()=>({ fetch: async()=>new Res('{}') }) } };
const L = new Lobby(st(), env);
const ok = (l,c,x='') => console.log((c?'  ok   ':'  FAIL ')+l+(x?'  '+x:''));

let r = await L.fetch(new Req('https://do/lobby/create',{method:'POST',body:'{"name":"a"}'}));
const code = (await r.json()).code;
let list = (await (await L.fetch(new Req('https://do/lobby/list'))).json()).rooms;
ok('new empty room is still listed (host is joining)', list.length === 1);

// host joins
await L.fetch(new Req('https://do/lobby/beat',{method:'POST',body:JSON.stringify({code,players:1})}));
list = (await (await L.fetch(new Req('https://do/lobby/list'))).json()).rooms;
ok('busy room listed', list.length === 1 && list[0].players === 1);

// host leaves -> beat with 0
await L.fetch(new Req('https://do/lobby/beat',{method:'POST',body:JSON.stringify({code,players:0})}));
list = (await (await L.fetch(new Req('https://do/lobby/list'))).json()).rooms;
ok('just-emptied room still listed briefly', list.length === 1);

// wind the clock forward 25s
L.rooms[code].emptySince -= 25000;
list = (await (await L.fetch(new Req('https://do/lobby/list'))).json()).rooms;
ok('empty room gone after 20s', list.length === 0, JSON.stringify(list));
process.exit(0);
