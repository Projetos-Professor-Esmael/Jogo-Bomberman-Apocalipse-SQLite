(()=>{
'use strict';
const $=s=>document.querySelector(s);
const canvas=$('#world');
const ctx=canvas.getContext('2d',{alpha:false});
if(!ctx){$('#mainMenu').innerHTML='<h2>Canvas 2D indisponível</h2><p>Atualize o navegador ou tente abrir o jogo no Edge/Chrome.</p>';return;}
const WORLDS=['FLORESTA PRIMORDIAL','FORJA VULCÂNICA','REINO GLACIAL','DESERTO DAS RUÍNAS','CIDADE MECÂNICA','SELVA SOMBRIA','MINAS DO ABISMO','FORTALEZA OBSIDIANA','DIMENSÃO CÓSMICA','APOCALIPSE FINAL'];
const THEMES=[['#173d2d','#276347','#70d99a'],['#54251c','#963e24','#ff9b53'],['#18394d','#286887','#8ce7ff'],['#554024','#92713a','#f6d17a'],['#26394b','#49677e','#8bd8ee'],['#183a29','#326c45','#8ce29b'],['#332a48','#594779','#c0a0ff'],['#392333','#70415c','#ff9bc2'],['#1e2858','#394da0','#a5b8ff'],['#4b1b2b','#8c2944','#ff8298']];
const POWER_NAMES={bomb:'BOMBA +',range:'FOGO +',speed:'VELOCIDADE',remote:'CONTROLE REMOTO',kick:'CHUTE',shield:'ESCUDO',heart:'VIDA',pierce:'PERFURANTE',crystal:'CRISTAL'};
const defaults={theme:'dark',music:0,sfx:75,quality:'high',difficulty:'normal',muted:false};
let settings={...defaults};try{settings={...defaults,...JSON.parse(localStorage.getItem('apoSettings')||'{}')};}catch{}
document.body.dataset.theme=settings.theme;
const saveSettings=()=>{try{localStorage.setItem('apoSettings',JSON.stringify(settings));}catch{}};
let save={unlocked:1,best:{},crystals:0,score:0,powers:{}};try{save={...save,...JSON.parse(localStorage.getItem('apoSave')||'{}')};}catch{}
const persist=()=>{try{localStorage.setItem('apoSave',JSON.stringify(save));}catch{}};

// Exportação/importação de um banco SQLite autocontido (duas páginas, tabela campaign).
// O formato é SQLite real; não é JSON apenas renomeado para .db.
const DB_PAGE=16384, DB_APP_ID=0x41504f43;
function putVarint(n){n=BigInt(n);if(n<0n)throw Error('Varint negativo');const a=[];do{a.push(Number(n&127n));n>>=7n;}while(n>0n);a.reverse();for(let i=0;i<a.length-1;i++)a[i]|=128;return a;}
function putU16(a,n){a.push((n>>>8)&255,n&255);}
function putU32(a,n){a.push((n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255);}
function utf8(s){return Array.from(new TextEncoder().encode(s));}
function recordPayload(values){
 const serial=[],body=[];
 for(const v of values){if(v===null){serial.push(0);continue;}if(typeof v==='number'&&Number.isInteger(v)){if(v>=-128&&v<=127){serial.push(1);body.push(v&255);}else if(v>=-32768&&v<=32767){serial.push(2);putU16(body,v&65535);}else{serial.push(4);putU32(body,v>>>0);}}else{const b=utf8(String(v));serial.push(13+2*b.length);body.push(...b);}}
 let head=serial.flatMap(x=>putVarint(x));let headerSize=head.length+putVarint(head.length+1).length;while(headerSize!==head.length+putVarint(headerSize).length)headerSize=head.length+putVarint(headerSize).length;
 return [...putVarint(headerSize),...head,...body];
}
function makeLeafPage(pageNo,values,rowid){
 const page=new Uint8Array(DB_PAGE),base=pageNo===1?100:0,rec=recordPayload(values),cell=[...putVarint(rec.length),...putVarint(rowid),...rec],start=DB_PAGE-cell.length;
 page[base]=0x0d;putU16At(page,base+1,0);putU16At(page,base+3,1);putU16At(page,base+5,start);page[base+7]=0;putU16At(page,base+8,start);page.set(cell,start);return page;
}
function putU16At(a,i,n){a[i]=(n>>>8)&255;a[i+1]=n&255;}
function createSQLiteFile(json){
 if(utf8(json).length>DB_PAGE-512)throw Error('O progresso ultrapassou o limite seguro de exportação.');
 const schemaSQL='CREATE TABLE campaign (id INTEGER PRIMARY KEY, data TEXT NOT NULL)';
 const p1=makeLeafPage(1,['table','campaign','campaign',2,schemaSQL],1);
 const p2=makeLeafPage(2,[null,json],1);
 const db=new Uint8Array(DB_PAGE*2);db.set(p1,0);db.set(p2,DB_PAGE);
 const magic=utf8('SQLite format 3\0');db.set(magic,0);putU16At(db,16,DB_PAGE);db[18]=1;db[19]=1;db[20]=0;db[21]=64;db[22]=32;db[23]=32;
 putU32At(db,24,1);putU32At(db,28,2);putU32At(db,40,1);putU32At(db,44,4);putU32At(db,56,1);putU32At(db,60,1);putU32At(db,68,DB_APP_ID);putU32At(db,92,1);putU32At(db,96,3045000);
 return new Blob([db],{type:'application/x-sqlite3'});
}
function putU32At(a,i,n){a[i]=(n>>>24)&255;a[i+1]=(n>>>16)&255;a[i+2]=(n>>>8)&255;a[i+3]=n&255;}
function readVarint(a,state){let v=0n;for(let i=0;i<9;i++){const b=a[state.i++];if(i===8){v=(v<<8n)|BigInt(b);return Number(v);}v=(v<<7n)|BigInt(b&127);if(!(b&128))return Number(v);}throw Error('Varint inválido');}
function readSQLiteCampaign(buffer){
 const a=new Uint8Array(buffer);if(a.length<DB_PAGE*2||new TextDecoder().decode(a.slice(0,16))!=='SQLite format 3\0')throw Error('O arquivo não é um banco SQLite válido.');
 const pageSize=(a[16]<<8)|a[17];if(pageSize!==DB_PAGE||a.length<pageSize*2)throw Error('Banco incompatível: tamanho de página inesperado.');
 const page=a.slice(pageSize,pageSize*2),base=0;if(page[base]!==0x0d)throw Error('Estrutura da tabela de progresso inválida.');
 const count=(page[base+3]<<8)|page[base+4];if(count<1)throw Error('O banco não contém campanha salva.');
 const ptr=(page[base+8]<<8)|page[base+9],st={i:ptr};const payloadSize=readVarint(page,st);readVarint(page,st);const end=st.i+payloadSize;const recordStart=st.i,headerSize=readVarint(page,st),headerEnd=recordStart+headerSize;
 // A tabela contém id INTEGER PRIMARY KEY (serial 0) e data TEXT.
 const serial=[];while(st.i<headerEnd){serial.push(readVarint(page,st));}
 let text='';for(let i=0;i<serial.length;i++){const type=serial[i];if(type>=13&&type%2===1){const len=(type-13)/2;text=new TextDecoder().decode(page.slice(st.i,st.i+len));st.i+=len;}else if(type===0){}else throw Error('Formato de registro não reconhecido.');}
 if(!text||st.i>end)throw Error('Dados da campanha ausentes ou corrompidos.');return JSON.parse(text);
}
function makeProgressSnapshot(){
 const state={};for(const k of Object.keys(S)){if(k==='keys')continue;state[k]=S[k];}
 state.mode='run';state.keys={};
 return {format:'BOMBERMAN_APOCALIPSE_SQLITE',version:1,createdAt:new Date().toISOString(),save,settings,state};
}
async function saveProgressFile(){
 if(!S.map.length){toast('INICIE UMA FASE ANTES DE SALVAR');return;}
 try{
  const payload=JSON.stringify(makeProgressSnapshot());
  const blob=createSQLiteFile(payload);
  // O navegador só pode gravar na pasta escolhida explicitamente pelo usuário.
  if(window.showDirectoryPicker){
   toast('SELECIONE A PASTA ONDE ESTÁ O INDEX.HTML');
   const dir=await window.showDirectoryPicker({id:'bomberman-project-folder',mode:'readwrite'});
   // Confirma que a pasta selecionada é realmente a pasta principal do projeto.
   await dir.getFileHandle('index.html');
   const handle=await dir.getFileHandle('bomberman_progresso.db',{create:true});
   const writable=await handle.createWritable();
   await writable.write(blob);
   await writable.close();
   toast('PROGRESSO SALVO NA PASTA DO JOGO');
  }else{
   // Compatibilidade: navegadores sem File System Access API ainda podem baixar o banco.
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='bomberman_progresso.db';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
   toast('NAVEGADOR SEM ACESSO À PASTA: ARQUIVO BAIXADO');
  }
 }catch(err){
  if(err?.name==='AbortError'){toast('SALVAMENTO CANCELADO');return;}
  console.error(err);
  const msg=err?.name==='NotFoundError'?'SELECIONE A PASTA QUE CONTÉM INDEX.HTML':(err.message||'ERRO AO GRAVAR O ARQUIVO');
  alert('Não foi possível salvar o progresso na pasta do jogo.\n'+msg);
 }
}

function importProgressFile(file){
 if(!file)return;const reader=new FileReader();reader.onload=()=>{try{
  const data=readSQLiteCampaign(reader.result);if(data.format!=='BOMBERMAN_APOCALIPSE_SQLITE'||data.version!==1||!data.state||!Array.isArray(data.state.map))throw Error('Este arquivo não contém um progresso compatível do Bomberman.');
  const st=data.state;if(!st.player||!st.powers||!Number.isFinite(st.level)||st.level<1||st.level>50||st.map.length!==N||st.map.some(row=>!Array.isArray(row)||row.length!==N))throw Error('O arquivo de progresso está incompleto ou inválido.');
  save={...{unlocked:1,best:{},crystals:0,score:0,powers:{}},...(data.save||{})};settings={...defaults,...(data.settings||{})};
  for(const k of Object.keys(S)){if(Object.prototype.hasOwnProperty.call(st,k))S[k]=st[k];}S.keys={};S.mode='run';
  saveSettings();persist();document.body.dataset.theme=settings.theme;settingsUI();updateHUD();$('#overlay').classList.add('hidden');toast('PROGRESSO IMPORTADO COM SUCESSO');
 }catch(err){console.error(err);alert('Não foi possível importar o progresso.\n'+(err.message||'Arquivo inválido.'));}finally{$('#progressFile').value='';}};reader.onerror=()=>alert('Falha ao ler o arquivo selecionado.');reader.readAsArrayBuffer(file);
}

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rand=(a,b)=>a+Math.random()*(b-a),choice=a=>a[Math.floor(Math.random()*a.length)];
const N=11,CELL=48;
const S={mode:'menu',level:1,time:180,score:0,crystals:0,lives:3,player:{x:1,z:1,inv:0},map:[],enemies:[],bombs:[],flames:[],items:[],particles:[],powers:{bomb:1,range:2,speed:1,remote:0,kick:0,shield:0,pierce:0},keys:{},clock:0,moveClock:0,enemyClock:0,exit:{x:9,z:9,open:false},crateTotal:0,cratesBroken:0};
const cell=(x,z)=>S.map[z]?.[x],walk=(x,z)=>x>=0&&z>=0&&x<N&&z<N&&cell(x,z)?.kind==='floor';
let audioCtx=null;
function tone(freq,dur,type='sine',vol=.1){if(settings.muted||settings.sfx===0)return;try{audioCtx??=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(vol*settings.sfx/100,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+dur);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur);}catch{}}
function boomSound(){tone(75,.28,'sawtooth',.24);}
function stageInfo(l){const w=Math.floor((l-1)/5),n=(l-1)%5+1;return{world:w,name:WORLDS[w],theme:THEMES[w],boss:l%5===0,difficulty:1+w*.2+(n-1)*.08};}
function genMap(){
 S.map=Array.from({length:N},(_,z)=>Array.from({length:N},(_,x)=>({kind:(x===0||z===0||x===N-1||z===N-1||(x%2===0&&z%2===0))?'wall':'floor'})));
 const safe=[[1,1],[2,1],[1,2],[3,1],[1,3],[2,2],[3,2],[2,3]];
 for(let z=1;z<N-1;z++)for(let x=1;x<N-1;x++){if(cell(x,z).kind!=='floor'||safe.some(([a,b])=>a===x&&b===z))continue;if(Math.random()<.43)S.map[z][x]={kind:'crate'};}
 // A saída fica em uma célula acessível e só pode ser usada após derrotar todos os inimigos.
 let exits=[];for(let z=N-2;z>=1;z--)for(let x=N-2;x>=1;x--)if(cell(x,z).kind==='floor'||cell(x,z).kind==='crate')exits.push([x,z]);
 const ex=exits.find(([x,z])=>Math.abs(x-1)+Math.abs(z-1)>10)||[9,9];S.exit={x:ex[0],z:ex[1],open:false};S.map[ex[1]][ex[0]]={kind:'exit'};
 S.crateTotal=S.map.flat().filter(c=>c.kind==='crate').length;S.cratesBroken=0;
 S.enemies=[];const count=Math.min(3+Math.floor(S.level*.45),13),spots=[];
 for(let z=2;z<N-1;z++)for(let x=2;x<N-1;x++)if(walk(x,z)&&Math.abs(x-1)+Math.abs(z-1)>4)spots.push([x,z]);
 for(let i=0;i<count&&spots.length;i++){const [x,z]=spots.splice(Math.floor(Math.random()*spots.length),1)[0];const boss=S.level%5===0&&i===0;S.enemies.push({x,z,hp:boss?4:1,boss,type:i%4,move:rand(.3,.9),alive:true});}
 S.bombs=[];S.flames=[];S.items=[];S.particles=[];S.player={x:1,z:1,inv:1.4};S.time=180;S.moveClock=0;S.enemyClock=0;
 S.powers={bomb:1,range:2,speed:1,remote:0,kick:0,shield:0,pierce:0,...(save.powers||{})};S.crystals=0;S.lives=3;S.score=0;
}
function toast(t){const el=$('#toast');el.textContent=t;el.style.opacity=1;clearTimeout(toast.t);toast.t=setTimeout(()=>el.style.opacity=0,1600);}
function showPanel(id){$('#overlay').classList.remove('hidden');document.querySelectorAll('.menu-card').forEach(el=>el.classList.add('hidden'));$(id).classList.remove('hidden');}
function mainMenu(){S.mode='menu';showPanel('#mainMenu');}
function updateHUD(){const inf=stageInfo(S.level);$('#worldName').textContent=`MUNDO ${String(inf.world+1).padStart(2,'0')} · ${inf.name}`;$('#levelName').textContent=`FASE ${String(S.level).padStart(2,'0')} / 50`;}
function startLevel(l){S.level=clamp(l,1,50);genMap();S.mode='run';$('#overlay').classList.add('hidden');updateHUD();tone(440,.12);toast(`FASE ${String(S.level).padStart(2,'0')} · ${stageInfo(S.level).name}`);}
function pause(){if(S.mode==='run'){S.mode='pause';showPanel('#pausePanel');}else if(S.mode==='pause'){S.mode='run';$('#overlay').classList.add('hidden');}}
function buildLevelGrid(){const g=$('#levelGrid');g.innerHTML='';for(let i=1;i<=50;i++){const b=document.createElement('button');b.className='level-tile'+(i>save.unlocked?' locked':'')+(i===S.level?' active':'');b.textContent=String(i).padStart(2,'0');b.disabled=i>save.unlocked;b.onclick=()=>startLevel(i);g.appendChild(b);}}
function settingsUI(){ $('#themeSelect').value=settings.theme;$('#sfxVol').value=settings.sfx;$('#sfxVal').textContent=settings.sfx+'%';$('#quality').value=settings.quality;$('#difficulty').value=settings.difficulty;$('#muteBtn').textContent=settings.muted?'SOM DESATIVADO':'SOM ATIVADO';}
$('#continueBtn').onclick=()=>startLevel(Math.max(1,Math.min(50,save.unlocked||1)));
$('#newBtn').onclick=()=>{save={unlocked:1,best:{},crystals:0,score:0,powers:{}};persist();startLevel(1);};
$('#levelsBtn').onclick=()=>{buildLevelGrid();showPanel('#levelsPanel');};$('#backLevels').onclick=mainMenu;
$('#settingsBtn').onclick=()=>showPanel('#settingsPanel');$('#backSettings').onclick=()=>showPanel(S.mode==='pause'?'#pausePanel':'#mainMenu');
$('#pauseSettingsBtn').onclick=()=>showPanel('#settingsPanel');$('#saveSettings').onclick=()=>{settings.theme=$('#themeSelect').value;settings.sfx=+$('#sfxVol').value;settings.quality=$('#quality').value;settings.difficulty=$('#difficulty').value;saveSettings();document.body.dataset.theme=settings.theme;settingsUI();toast('CONFIGURAÇÕES SALVAS');};
$('#sfxVol').oninput=e=>$('#sfxVal').textContent=e.target.value+'%';$('#muteBtn').onclick=()=>{settings.muted=!settings.muted;settingsUI();saveSettings();};
$('#saveProgressBtn').onclick=saveProgressFile;$('#pauseSaveBtn').onclick=saveProgressFile;$('#importProgressBtn').onclick=()=>$('#progressFile').click();$('#pauseImportBtn').onclick=()=>$('#progressFile').click();$('#progressFile').addEventListener('change',e=>importProgressFile(e.target.files[0]));
$('#pauseBtn').onclick=pause;$('#resumeBtn').onclick=pause;$('#quitBtn').onclick=mainMenu;$('#resultMenuBtn').onclick=mainMenu;$('#retryBtn').onclick=()=>startLevel(S.level);$('#nextBtn').onclick=()=>startLevel(Math.min(50,S.level+1));
function move(dx,dz){if(S.mode!=='run')return;const p=S.player,nx=p.x+dx,nz=p.z+dz;if(!walk(nx,nz)&&!(cell(nx,nz)?.kind==='exit'&&S.exit.open))return;
 const bomb=S.bombs.find(b=>!b.dead&&b.x===nx&&b.z===nz);if(bomb){if(S.powers.kick>0){const bx=nx+dx,bz=nz+dz;if(walk(bx,bz)&&!S.bombs.some(q=>q!==bomb&&!q.dead&&q.x===bx&&q.z===bz)){bomb.x=bx;bomb.z=bz;}else return;}else return;}
 if(S.enemies.some(e=>e.alive&&e.x===nx&&e.z===nz))return;p.x=nx;p.z=nz;tone(165,.025,'sine',.025);collect();if(S.exit.open&&p.x===S.exit.x&&p.z===S.exit.z)finish(true);
}
function placeBomb(){if(S.mode!=='run'||S.bombs.filter(b=>!b.dead).length>=Math.max(1,S.powers.bomb))return;const p=S.player;if(S.bombs.some(b=>b.x===p.x&&b.z===p.z))return;S.bombs.push({x:p.x,z:p.z,t:S.powers.remote?999:2.0,range:Math.max(1,S.powers.range),remote:!!S.powers.remote,dead:false});tone(115,.1,'triangle',.1);}
function detonate(){S.bombs.forEach(b=>{if(b.remote)b.t=.01;});}
function particle(x,z,color){S.particles.push({x:x+rand(-.3,.3),z:z+rand(-.3,.3),vx:rand(-1,1),vz:rand(-1,1),t:.55,color});}
function dropItem(x,z){const type=choice(['bomb','range','speed','remote','kick','shield','heart','pierce','crystal']);S.items.push({x,z,type,spin:rand(0,6)});}
function hitPlayer(){if(S.player.inv>0)return;S.lives--;S.player.inv=1.8;tone(90,.25,'sawtooth',.2);if(S.lives<=0)finish(false);}
function burst(b){if(b.dead)return;b.dead=true;boomSound();const cells=[[b.x,b.z]],dirs=[[1,0],[-1,0],[0,1],[0,-1]];
 for(const [dx,dz] of dirs)for(let i=1;i<=b.range;i++){const x=b.x+dx*i,z=b.z+dz*i,c=cell(x,z);if(!c||c.kind==='wall')break;cells.push([x,z]);if(c.kind==='crate'){c.kind='floor';S.cratesBroken++;S.score+=30;if(Math.random()<.38)dropItem(x,z);if(S.powers.pierce<=0)break;}}
 for(const [x,z] of cells){S.flames.push({x,z,t:.48});for(const e of S.enemies)if(e.alive&&e.x===x&&e.z===z){e.hp--;if(e.hp<=0){e.alive=false;S.score+=e.boss?1200:150;for(let k=0;k<9;k++)particle(x,z,'#ff9a42');}}if(S.player.x===x&&S.player.z===z){if(S.powers.shield>0)S.powers.shield--;else hitPlayer();}}
 for(const other of S.bombs)if(other!==b&&!other.dead&&cells.some(([x,z])=>x===other.x&&z===other.z))other.t=.01;
}
function collect(){for(const it of S.items){if(it.x!==S.player.x||it.z!==S.player.z||it.got)continue;it.got=true;if(it.type==='crystal'){S.crystals++;S.score+=100;}else if(it.type==='heart')S.lives=Math.min(5,S.lives+1);else S.powers[it.type]=Math.min(it.type==='range'?8:it.type==='speed'?4:it.type==='bomb'?6:3,(S.powers[it.type]||0)+1);tone(650,.12);toast(POWER_NAMES[it.type]||'BÔNUS');}S.items=S.items.filter(i=>!i.got);}
function finish(win){if(S.mode==='result')return;S.mode='result';const t=Math.max(0,Math.floor(S.time));if(win){save.unlocked=Math.max(save.unlocked,Math.min(50,S.level+1));save.best[S.level]=Math.max(save.best[S.level]||0,S.score);save.score+=S.score;save.crystals+=S.crystals;save.powers={...S.powers};persist();}
 $('#resultOverline').textContent=win?'MISSÃO CONCLUÍDA':'MISSÃO ENCERRADA';$('#resultTitle').textContent=win?(S.level===50?'APOCALIPSE SUPERADO':'PORTAL ABERTO'):'VOCÊ FOI DERROTADO';$('#resultText').textContent=win?'Todos os inimigos foram derrotados. O portal dimensional está estável.':'Suas vidas acabaram. Reorganize sua estratégia e tente novamente.';$('#resultScore').textContent=S.score;$('#resultCrystals').textContent=S.crystals;$('#resultTime').textContent=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');$('#nextBtn').style.display=win&&S.level<50?'block':'none';showPanel('#resultPanel');}
function update(dt){if(S.mode!=='run')return;S.clock+=dt;S.time-=dt;if(S.time<=0){S.time=0;finish(false);return;}S.player.inv=Math.max(0,S.player.inv-dt);
 let dx=0,dz=0;if(S.keys.ArrowLeft||S.keys.a)dx=-1;else if(S.keys.ArrowRight||S.keys.d)dx=1;else if(S.keys.ArrowUp||S.keys.w)dz=-1;else if(S.keys.ArrowDown||S.keys.s)dz=1;
 if(dx||dz){S.moveClock-=dt;if(S.moveClock<=0){move(dx,dz);const difficultyFactor=settings.difficulty==='easy'?1.2:settings.difficulty==='hard'?.8:1;S.moveClock=.14/(Math.max(1,S.powers.speed*.65)*difficultyFactor);}}else S.moveClock=0;
 for(const b of S.bombs){b.t-=dt;if(b.t<=0)burst(b);}S.bombs=S.bombs.filter(b=>!b.dead);
 for(const f of S.flames)f.t-=dt;S.flames=S.flames.filter(f=>f.t>0);
 S.enemyClock-=dt;if(S.enemyClock<=0){S.enemyClock=.48*(settings.difficulty==='easy'?1.2:settings.difficulty==='hard'?.78:1);for(const e of S.enemies){if(!e.alive)continue;const dirs=[[1,0],[-1,0],[0,1],[0,-1]].sort(()=>Math.random()-.5);for(const [a,b] of dirs){const x=e.x+a,z=e.z+b;if(walk(x,z)&&!S.bombs.some(q=>q.x===x&&q.z===z)&&!S.enemies.some(q=>q!==e&&q.alive&&q.x===x&&q.z===z)){e.x=x;e.z=z;break;}}if(e.x===S.player.x&&e.z===S.player.z)hitPlayer();}}
 collect();for(const q of S.particles){q.t-=dt;q.x+=q.vx*dt;q.z+=q.vz*dt;}S.particles=S.particles.filter(q=>q.t>0);
 const remaining=S.enemies.filter(e=>e.alive).length;if(remaining===0)S.exit.open=true;
 $('#objective').textContent=S.exit.open?'Entre no portal dimensional':'Derrote os inimigos e encontre o portal';$('#progressBar').style.width=(S.cratesBroken/Math.max(1,S.crateTotal)*100)+'%';$('#timer').textContent=String(Math.floor(S.time/60)).padStart(2,'0')+':'+String(Math.floor(S.time%60)).padStart(2,'0');$('#crystalCount').textContent=String(S.crystals).padStart(3,'0');$('#lives').textContent='♥ '.repeat(S.lives)||'—';$('#powerList').innerHTML=Object.entries(S.powers).filter(([k,v])=>v>0).map(([k,v])=>`<span class="power">${POWER_NAMES[k]||k} ${v}</span>`).join('');
}
function roundedRect(c,x,y,w,h,r){c.beginPath();c.roundRect?c.roundRect(x,y,w,h,r):(c.rect(x,y,w,h));}
function draw(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight,dpr=Math.min(devicePixelRatio||1,settings.quality==='low'?1:settings.quality==='ultra'?1.5:1.2);if(canvas.width!==Math.floor(w*dpr)||canvas.height!==Math.floor(h*dpr)){canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);
 const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,settings.theme==='light'?'#dce8f1':'#0a1725');bg.addColorStop(1,settings.theme==='light'?'#b7cbd9':'#030812');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 // estrelas discretas no fundo
 for(let i=0;i<45;i++){const x=(i*137.5)%w,y=(i*71.7)%h;ctx.fillStyle=`rgba(150,210,255,${.08+(i%4)*.035})`;ctx.fillRect(x,y,2,2);}
 if(!S.map.length)return;
 const boardSize=Math.min(w-28,h-145,Math.min(w*.72,650));const tile=Math.max(20,Math.floor(boardSize/N));const size=tile*N;const ox=Math.floor((w-size)/2),oy=Math.max(88,Math.floor((h-size)/2+12));const theme=stageInfo(S.level).theme;
 ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=28;ctx.fillStyle='#07111d';roundedRect(ctx,ox-9,oy-9,size+18,size+18,14);ctx.fill();ctx.restore();
 for(let z=0;z<N;z++)for(let x=0;x<N;x++){const px=ox+x*tile,py=oy+z*tile,c=cell(x,z);ctx.fillStyle=((x+z)&1)?theme[0]:theme[1];ctx.fillRect(px,py,tile-1,tile-1);
 if(c.kind==='wall'){ctx.fillStyle='#263b50';ctx.fillRect(px+2,py+2,tile-4,tile-4);ctx.fillStyle='#38536a';ctx.fillRect(px+4,py+4,tile-8,5);ctx.fillStyle='#172a3d';ctx.fillRect(px+4,py+tile-9,tile-8,5);}
 else if(c.kind==='crate'){ctx.fillStyle='#75421f';ctx.fillRect(px+4,py+4,tile-8,tile-8);ctx.strokeStyle='#d99a4c';ctx.lineWidth=3;ctx.strokeRect(px+6,py+6,tile-12,tile-12);ctx.beginPath();ctx.moveTo(px+8,py+8);ctx.lineTo(px+tile-8,py+tile-8);ctx.moveTo(px+tile-8,py+8);ctx.lineTo(px+8,py+tile-8);ctx.stroke();}
 else if(c.kind==='exit'){ctx.fillStyle=S.exit.open?'#13d9c2':'#273548';ctx.fillRect(px+5,py+5,tile-10,tile-10);ctx.strokeStyle=S.exit.open?'#9efff2':'#596b7e';ctx.lineWidth=3;ctx.strokeRect(px+8,py+8,tile-16,tile-16);ctx.fillStyle=S.exit.open?'#dffffb':'#9aa9b8';ctx.font=`bold ${tile*.42}px Arial`;ctx.textAlign='center';ctx.fillText('✦',px+tile/2,py+tile*.66);}
 }
 // portal pulse
 if(S.exit.open){const x=ox+S.exit.x*tile+tile/2,y=oy+S.exit.z*tile+tile/2;ctx.strokeStyle=`rgba(95,255,231,${.45+.35*Math.sin(S.clock*5)})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,tile*.36+Math.sin(S.clock*5)*2,0,Math.PI*2);ctx.stroke();}
 for(const it of S.items){const x=ox+it.x*tile+tile/2,y=oy+it.z*tile+tile/2+Math.sin(S.clock*4+it.spin)*3;ctx.save();ctx.translate(x,y);ctx.shadowColor='#fff';ctx.shadowBlur=9;ctx.fillStyle=it.type==='crystal'?'#56edff':it.type==='heart'?'#ff557c':'#a8ff9a';ctx.beginPath();ctx.arc(0,0,tile*.19,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#102235';ctx.font=`bold ${tile*.22}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(it.type==='crystal'?'◆':it.type==='heart'?'♥':it.type==='bomb'?'B':it.type==='range'?'F':'+',0,1);ctx.restore();}
 for(const b of S.bombs){const x=ox+b.x*tile+tile/2,y=oy+b.z*tile+tile/2;ctx.fillStyle='#050a12';ctx.beginPath();ctx.arc(x,y,tile*.29,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff784e';ctx.beginPath();ctx.arc(x+tile*.12,y-tile*.18,tile*.09,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffd47a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,tile*(.34+.04*Math.sin(S.clock*12)),0,Math.PI*2);ctx.stroke();}
 for(const f of S.flames){const x=ox+f.x*tile,y=oy+f.z*tile;ctx.fillStyle=`rgba(255,${100+Math.floor(100*f.t/.48)},35,${Math.min(1,f.t*2.5)})`;ctx.shadowColor='#ff6a22';ctx.shadowBlur=13;ctx.fillRect(x+3,y+3,tile-7,tile-7);ctx.shadowBlur=0;}
 for(const e of S.enemies){if(!e.alive)continue;const x=ox+e.x*tile+tile/2,y=oy+e.z*tile+tile/2;ctx.save();ctx.fillStyle=e.boss?'#a91e42':['#44c878','#e46b45','#4b9ce8','#b46be0'][e.type];ctx.shadowColor=e.boss?'#ff315d':'#000';ctx.shadowBlur=e.boss?13:5;ctx.beginPath();ctx.arc(x,y,tile*(e.boss?.36:.29),0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x-tile*.1,y-tile*.04,tile*.055,0,Math.PI*2);ctx.arc(x+tile*.1,y-tile*.04,tile*.055,0,Math.PI*2);ctx.fill();ctx.fillStyle='#152033';ctx.beginPath();ctx.arc(x-tile*.1,y-tile*.04,tile*.025,0,Math.PI*2);ctx.arc(x+tile*.1,y-tile*.04,tile*.025,0,Math.PI*2);ctx.fill();if(e.boss){ctx.fillStyle='#ffcc6d';ctx.fillRect(x-tile*.25,y-tile*.42,tile*.5,4);}ctx.restore();}
 const p=S.player;if(!(p.inv>0&&Math.floor(S.clock*12)%2===0)){const x=ox+p.x*tile+tile/2,y=oy+p.z*tile+tile/2;ctx.save();ctx.shadowColor='#54dfff';ctx.shadowBlur=12;ctx.fillStyle='#168fc4';ctx.beginPath();ctx.arc(x,y,tile*.31,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#e8f6ff';ctx.beginPath();ctx.arc(x,y-tile*.04,tile*.22,0,Math.PI*2);ctx.fill();ctx.fillStyle='#102438';ctx.fillRect(x-tile*.12,y-tile*.08,tile*.07,3);ctx.fillRect(x+tile*.05,y-tile*.08,tile*.07,3);ctx.fillStyle='#ffcf70';ctx.fillRect(x-tile*.14,y+tile*.16,tile*.28,3);ctx.restore();}
 for(const q of S.particles){ctx.globalAlpha=Math.max(0,q.t/.55);ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(ox+q.x*tile,oy+q.z*tile,3,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
 ctx.fillStyle='rgba(255,255,255,.6)';ctx.font='10px Arial';ctx.textAlign='center';ctx.fillText('CAMPO DE BATALHA · ' + stageInfo(S.level).name,ox+size/2,oy+size+20);
}
let last=performance.now();function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;update(dt);draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.addEventListener('keydown',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();S.keys[k]=true;if(e.repeat)return;if(e.key===' '){placeBomb();}if(k==='e')detonate();if(k==='p'||e.key==='Escape')pause();});
window.addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;S.keys[k]=false;});
function bindHold(id,key){const b=$(id);if(!b)return;b.addEventListener('pointerdown',e=>{e.preventDefault();S.keys[key]=true;b.setPointerCapture(e.pointerId);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>S.keys[key]=false);}
bindHold('#touchLeft','ArrowLeft');bindHold('#touchRight','ArrowRight');bindHold('#touchUp','ArrowUp');bindHold('#touchDown','ArrowDown');$('#touchBomb').onclick=placeBomb;
window.addEventListener('blur',()=>{S.keys={};if(S.mode==='run')pause();});
settingsUI();mainMenu();
})();
