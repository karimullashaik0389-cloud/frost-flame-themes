/* Local-only Games & Stories: no network, analytics, accounts, cart or order writes. */
(function(){
'use strict';
if(window.FFPlay)return;
const D=window.FFPlayData;
if(!D)return;
let pill,modal,body,nudge,previousFocus,oldOverflow='',tab='puzzles';
let quiz=null,cardIndices={truth:[],dare:[]},cardType='truth',cardNumber=0;
const theme=()=>document.documentElement.getAttribute('data-ff-theme')||sessionStorage.getItem('ff_entry_theme')||'';
const tags=()=>({family_kids:['kids','family'],couple:['couple'],friends:['friends'],gang:['gang','friends'],family:['family'],solo_m:['solo_m'],solo_f:['solo_f']}[theme()]||[]);
const order=items=>items.map((v,i)=>({v,i,score:v.tags.reduce((s,t)=>s+(tags().includes(t)?1:0),0)})).sort((a,b)=>b.score-a.score||a.i-b.i).map(x=>x.v);
function node(tag,text,cls){let e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function button(text,fn,parent=body){const b=node('button',text);b.type='button';b.onclick=fn;parent.append(b);return b;}
function para(text,cls){const p=node('p',text,cls);body.append(p);return p;}
function reset(title){window.FFExtras?.stop();delete body.dataset.ffExtra;delete body.dataset.ffReader;body.replaceChildren();const r=node('div',undefined,'fp-row');body.append(r);button('← Corner',()=>{tab='puzzles';home();},r);button('Close ×',close,r).setAttribute('aria-label','Close Games & Stories');body.append(node('h2',title));document.getElementById('ff-play-sheet').scrollTop=0;}
function open(){if(theme()==='couple')tab='couples';else if(theme()==='family_kids')tab='snake';previousFocus=document.activeElement;oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';modal.hidden=false;nudge.hidden=true;home();modal.querySelector('button').focus();}
function close(){window.FFExtras?.stop();modal.hidden=true;document.body.style.overflow=oldOverflow;if(previousFocus&&previousFocus.isConnected)previousFocus.focus();}
function home(){reset('Games & Stories');para('A little company while you wait. Play gently, take your time, stop whenever food arrives.','fp-muted');
const tabs=node('div',undefined,'fp-row');tabs.setAttribute('role','tablist');body.append(tabs);
const choices=theme()==='family_kids'?['snake','scoop','books','puzzles','quiz','stories','couples']:theme()==='couple'?['couples','books','scoop','snake','puzzles','quiz','stories']:['puzzles','books','scoop','snake','quiz','stories','couples'];
choices.forEach(t=>{const b=button({puzzles:'Puzzles',stories:'Stories',quiz:'Quiz rounds',couples:'Truth or Dare',books:'Books',scoop:'Scoop Sort',snake:'Kids Snake'}[t],()=>{tab=t;home();},tabs);b.setAttribute('role','tab');b.setAttribute('aria-selected',String(t===tab));});
if(['books','scoop','snake'].includes(tab)){window.FFExtras.render(tab,body,theme());}else if(tab==='puzzles'){
para('12 light-but-tricky challenges · allow around 5–10 minutes to explore one. Some may click sooner. No timer or pressure.','fp-muted');
list(order(D.puzzles),p=>p.title,p=>'Think · two hints · answer explained',p=>showPuzzle(p));
}else if(tab==='stories'){
para('Nine original fictional mini-stories · around a minute at a relaxed pace.','fp-muted');list(order(D.stories),s=>s.title,s=>'Original fiction · a quiet little read',showStory);
}else if(tab==='quiz'){
para('Six rounds, ten questions each. A small fact after every answer. Just for fun — no food or allergy advice.','fp-muted');
list(order(D.rounds),r=>r.title,r=>'10 questions · solo or pass the phone',setupQuiz);
}else{
para('A sweet couples game: 40 truths + 40 dares. Only do what both enjoy. Skip freely; no strangers, photos, explicit prompts or leaving the table.','fp-muted');button('Play Truth or Dare',()=>drawCard('truth'));}
}
function list(items,title,sub,fn){const l=node('div',undefined,'fp-list');body.append(l);items.forEach(it=>{const b=button('',()=>fn(it),l);b.className='fp-card';b.append(node('strong',title(it)),node('span',sub(it)));});}
function showPuzzle(p){reset(p.title);para(p.question);const hintOut=node('div');hintOut.setAttribute('aria-live','polite');body.append(hintOut);let hints=0;const hintBtn=button('Show hint 1',()=>{hintOut.append(node('p','Hint '+(hints+1)+': '+p.hints[hints]));hints++;hintBtn.textContent=hints<2?'Show hint 2':'Both hints shown';hintBtn.disabled=hints===2;});let shown=false;const answerBtn=button('Reveal answer',()=>{if(shown)return;shown=true;para(p.answer,'fp-answer');answerBtn.disabled=true;});para('No answer is sent anywhere. Think together, draw on your own paper, or simply read the explanation.','fp-muted');}
function showStory(s){reset(s.title);para('Original fiction · around a minute','fp-muted');const text=node('article',undefined,'fp-story');const words=s.text.split(' ');const midpoint=Math.floor(words.length/2);text.append(node('p',words.slice(0,midpoint).join(' ')),node('p',words.slice(midpoint).join(' ')));body.append(text);button('Another story',()=>{tab='stories';home();});}
function setupQuiz(round){reset(round.title);para('Choose a mode. The same phone moves to the next player after each question.');const row=node('div',undefined,'fp-row');body.append(row);button('Solo',()=>startQuiz(round,1),row);[2,3,4].forEach(n=>button('Pass the phone · '+n,()=>startQuiz(round,n),row));}
function shuffle(arr){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function startQuiz(round,players){quiz={round,players,i:0,scores:Array(players).fill(0),answered:false};question();}
function question(){const Q=quiz;reset(Q.round.title);if(Q.i>=Q.round.questions.length){para('Round complete!','fp-answer');Q.scores.forEach((s,i)=>para((Q.players>1?'Player '+(i+1)+': ':'Score: ')+s+' / '+Q.round.questions.filter((_,j)=>j%Q.players===i).length));button('Choose another round',()=>{tab='quiz';home();});return;}
const q=Q.round.questions[Q.i],player=Q.i%Q.players;Q.answered=false;
para('Question '+(Q.i+1)+' of 10'+(Q.players>1?' · Player '+(player+1)+' — your turn!':''),'fp-muted');para(q.q);
const opts=node('div',undefined,'fp-list');body.append(opts);const fact=node('div');fact.setAttribute('aria-live','polite');body.append(fact);
shuffle(q.options.map((text,i)=>({text,i}))).forEach(o=>{const b=button(o.text,()=>{if(Q.answered)return;Q.answered=true;const ok=o.i===q.correct;if(ok)Q.scores[player]++;[...opts.children].forEach(btn=>{btn.disabled=true;if(btn.textContent===q.options[q.correct])btn.classList.add('fp-good');});b.classList.add(ok?'fp-good':'fp-wrong');fact.className='fp-fact';fact.textContent=(ok?'Nice one! ':'Good try! Correct: '+q.options[q.correct]+'. ')+q.fact;button(Q.i===9?'See scores':Q.players>1?'Pass phone → next player':'Next question',()=>{Q.i++;question();});},opts);});
}
function drawCard(kind){cardType=kind;reset('Couples · Truth or Dare');para('Take turns. Ask first, keep it kind, skip without explaining.','fp-muted');const row=node('div',undefined,'fp-row');body.append(row);button('♡ Truth',()=>drawCard('truth'),row);button('✧ Dare',()=>drawCard('dare'),row);
const pack=kind==='truth'?D.truths:D.dares;if(!cardIndices[kind].length)cardIndices[kind]=shuffle(pack.map((_,i)=>i));const idx=cardIndices[kind].pop();cardNumber++;
para((kind==='truth'?'TRUTH':'DARE')+' · card '+cardNumber,'fp-muted');const card=node('div',pack[idx],'fp-flip');card.setAttribute('data-card-kind',kind);body.append(card);button('Flip another '+kind,()=>drawCard(kind));button('Skip — no pressure',()=>drawCard(kind));para('Food sharing is always optional: check allergies and comfort first. A compliment is a fine alternative.','fp-muted');}
function position(){if(!pill)return;let bottom=160;const rect=()=>({left:12,right:168,top:innerHeight-bottom-44,bottom:innerHeight-bottom});const reserved=[...document.querySelectorAll('[data-testid="frosty-fab"],#ff-float-toggle,[data-testid*="cart-strip"],[data-testid*="sticky-cart"]')];for(let tries=0;tries<5;tries++){const r=rect();const hit=reserved.some(el=>{if(!el.getClientRects().length)return false;const a=el.getBoundingClientRect();return r.left<a.right+8&&r.right>a.left-8&&r.top<a.bottom+8&&r.bottom>a.top-8;});if(!hit)break;bottom+=56;}pill.style.bottom=bottom+'px';nudge.style.bottom=(bottom+55)+'px';}
function entryOpen(){return ['ff-tree-root','ff-float-root'].some(id=>{const el=document.getElementById(id);return el&&!el.hidden;});}
function boot(){pill=node('button','🎲 Games & Stories');pill.id='ff-play-pill';pill.type='button';pill.onclick=open;document.body.append(pill);
modal=node('div');modal.id='ff-play-modal';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Games and Stories');body=node('section');body.id='ff-play-sheet';modal.append(body);document.body.append(modal);
nudge=node('aside');nudge.id='ff-play-nudge';nudge.hidden=true;nudge.setAttribute('aria-label','Optional waiting-time activity');nudge.append(node('div','Still waiting? A tiny puzzle or story can keep you company.'));button('Have a look',open,nudge);button('Not now',()=>nudge.hidden=true,nudge);document.body.append(nudge);
document.addEventListener('keydown',e=>{if(modal.hidden)return;if(e.key==='Escape'){close();return;}if(e.key==='Tab'){const focus=[...modal.querySelectorAll('button:not(:disabled),select')];const a=focus[0],z=focus[focus.length-1];if(!modal.contains(document.activeElement)){e.preventDefault();a.focus();return;}if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}}});
window.addEventListener('resize',position);position();
let shown=sessionStorage.getItem('ff_play_nudged')==='1';let arrival=Number(sessionStorage.getItem('ff_play_arrival'))||Date.now();sessionStorage.setItem('ff_play_arrival',String(arrival));const delay=new URLSearchParams(location.search).get('fast')==='1'?8000:300000;
const watch=setInterval(()=>{position();if(!shown&&Date.now()-arrival>=delay&&!entryOpen()&&modal.hidden&&!/^\/(login|signup|admin)/.test(location.pathname)){shown=true;sessionStorage.setItem('ff_play_nudged','1');nudge.hidden=false;}},1000);
window.FFPlay={open,close,home,showPuzzle,showStory,setupQuiz,startQuiz,drawCard,data:D,position,getQuiz:()=>quiz};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
