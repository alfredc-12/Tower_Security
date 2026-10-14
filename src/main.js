import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EYE_HEIGHT,moveWalker,safeWalkingPosition,acceptsPin } from './physics.js';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/600.css';
import './font.css';

const $=id=>document.getElementById(id);
const touch=matchMedia('(pointer:coarse)').matches;
const keys=new Set(),proxies=[],doors=[],towerState=new Map();
let ready=false,started=false,paused=true,mode='walk',inspection=null,aim=null,transition=null,manifest=null,model=null,savedPose=null,toastTimer;
const scene=new THREE.Scene();scene.background=new THREE.Color('#c9e0e8');scene.fog=new THREE.Fog('#c9e0e8',90,185);
const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.08,230);camera.position.set(38,26,42);camera.lookAt(0,9,0);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(error){$('loading').textContent='This browser could not start 3D graphics. Try a current browser with hardware acceleration enabled.';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.90;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate=false;
renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','3D environment. Click to look around; press E to interact.');$('world').append(renderer.domElement);
const controls=new PointerLockControls(camera,renderer.domElement);controls.minPolarAngle=.05;controls.maxPolarAngle=Math.PI-.05;
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xe7f3ff,0x7e8a60,1.1));
const sun=new THREE.DirectionalLight(0xfff5dd,2.4);sun.position.set(-28,50,25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-42,right:42,top:28,bottom:-28,near:.1,far:140});sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;scene.add(sun);
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),box=new THREE.Box3(),clock=new THREE.Clock();
const dummy=new THREE.PerspectiveCamera(),direction=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
const descriptions={
 'CCTV recorder':'Stores camera footage inside the locked service bay. This demonstration does not record your visit.',
 'Network and alert link':'Connects the local cameras and carries alarm notifications to the designated responder.',
 'Intrusion alarm controller':'Receives gate, cabinet-door and motion sensor signals.',
 'Visitor logbook':'Authorized staff record their name, visit purpose, arrival and departure inside the protected enclosure.',
 'Backup battery compartment':'A separated lower battery bay represents backup power for essential security equipment.'
};
function notify(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2700);}
function proxy(kind,tower,position,size,name,item=null){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false}));mesh.position.fromArray(position);mesh.userData={kind,tower,name,item};mesh.renderOrder=-10;scene.add(mesh);proxies.push(mesh);return mesh;
}
function doorState(t,kind){return towerState.get(t.id)[kind];}
function makeDoor(t,kind){const node=model.getObjectByName(t[kind]);if(!node)throw new Error(`Missing ${t[kind]} in model`);const d={node,kind,tower:t,angle:0,target:0,open:false};doors.push(d);return d;}
function keypadFace(t){
 const c=document.createElement('canvas');c.width=240;c.height=380;const ctx=c.getContext('2d');ctx.fillStyle='#14282e';ctx.fillRect(0,0,240,380);ctx.fillStyle='#69cb9d';ctx.fillRect(27,24,186,60);ctx.fillStyle='#09281b';ctx.font='bold 23px sans-serif';ctx.textAlign='center';ctx.fillText('ENTER PIN',120,63);
 ['1','2','3','4','5','6','7','8','9','C','0','↵'].forEach((s,i)=>{const x=32+(i%3)*65,y=112+Math.floor(i/3)*59;ctx.fillStyle='#a5b5ba';ctx.fillRect(x,y,48,43);ctx.fillStyle='#132a34';ctx.font='bold 24px sans-serif';ctx.fillText(s,x+24,y+30);});
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const face=new THREE.Mesh(new THREE.PlaneGeometry(.235,.372),new THREE.MeshBasicMaterial({map:texture}));face.position.set(t.keypad[0],t.keypad[1],6.480);scene.add(face);
}
function currentBoxes(){
 const boxes=[...manifest.colliders];
 for(const t of manifest.towers){const cx=t.center[0];boxes.push({min:[cx-2.65,0,-3.05],max:[cx+1.05,1.9,.88]});}
 for(const d of doors){box.setFromObject(d.node);boxes.push({min:box.min.toArray(),max:box.max.toArray()});}
 return boxes;
}
function showPause(){if(!started||inspection)return;paused=true;keys.clear();$('pause').hidden=false;$('crosshair').hidden=true;$('target').hidden=true;}
function capture(){if(!ready)return;paused=false;$('pause').hidden=true;$('crosshair').hidden=false;if(!touch){try{controls.lock();}catch{notify('Click the scene to enable mouse look.');}}}
function start(){if(!ready)return;started=true;$('welcome').hidden=true;if(touch)$('touch').hidden=false;camera.position.set(0,EYE_HEIGHT,10);camera.lookAt(0,EYE_HEIGHT,0);setMode('walk',false);capture();}
controls.addEventListener('unlock',showPause);
controls.addEventListener('lock',()=>{paused=false;$('pause').hidden=true;});
document.addEventListener('pointerlockerror',()=>{if(!inspection)notify('Mouse capture is unavailable. Drag on the scene to look around.');});
function setMode(next,announce=true){
 if(inspection)leaveInspection(false);
 mode=next;keys.clear();
 if(ready&&next==='walk'){const p=safeWalkingPosition(camera.position,currentBoxes());camera.position.set(p.x,p.y,p.z);}
 $('walk').classList.toggle('selected',mode==='walk');$('fly').classList.toggle('selected',mode==='fly');$('mode-label').textContent=mode==='walk'?'Walking':'Flying';
 if(announce)notify(mode==='fly'?'Flying: Space up · C down · 1 to walk':'Walking: ground and obstacle collision enabled');
}
function tweenTo(position,target,onComplete){dummy.position.copy(position);dummy.lookAt(target);transition={from:camera.position.clone(),to:position.clone(),q0:camera.quaternion.clone(),q1:dummy.quaternion.clone(),elapsed:0,duration:matchMedia('(prefers-reduced-motion:reduce)').matches?.05:.75,onComplete};}
function beginInspection(kind,t,item=null){
 if(!inspection){savedPose={position:camera.position.clone(),quaternion:camera.quaternion.clone()};}
 inspection={kind,tower:t,item};paused=true;keys.clear();controls.unlock();$('pause').hidden=true;$('target').hidden=true;$('crosshair').hidden=true;$('inspection').hidden=false;
 $('keypad-panel').hidden=kind!=='keypad';$('equipment-panel').hidden=kind!=='service'&&kind!=='radio';$('item-panel').hidden=kind!=='item';
 let target,pos;
 if(kind==='keypad'){
  target=new THREE.Vector3(...t.keypad);pos=target.clone().add(new THREE.Vector3(.05,.02,1.12));
  $('inspection-name').textContent=`Tower ${t.id} · Gate keypad`;$('inspection-description').textContent='Enter the demo PIN to unlock and open this gate.';
  $('gate-state').textContent=towerState.get(t.id).unlocked?'Gate unlocked':'Gate locked';$('pin').value='';$('pin-message').textContent='';$('gate-close').hidden=!towerState.get(t.id).unlocked;
  setTimeout(()=>$('pin').focus(),100);
 }else if(kind==='service'||kind==='radio'){
  target=new THREE.Vector3(...t.serviceFocus);if(kind==='radio')target.x+=1.22;
  pos=target.clone().add(new THREE.Vector3(.12,.10,2.45));
  $('inspection-name').textContent=`Tower ${t.id} · ${kind==='service'?'Protected service compartment':'Telecommunications compartment'}`;
  $('inspection-description').textContent=kind==='service'?'Visitor records and security equipment are secured inside.':'Radio and power equipment sit in their own locked bay.';
  $('equipment-list').replaceChildren();
  if(kind==='service')for(const item of t.items){const b=document.createElement('button');b.textContent=item.name;b.addEventListener('click',()=>beginInspection('item',t,item));$('equipment-list').append(b);}
  else $('equipment-list').textContent='Radio and power modules, ventilation, protected cable routes and door contacts.';
 }else{
  target=new THREE.Vector3(...item.position);
  const offset=item.name==='Visitor logbook'?new THREE.Vector3(0,.40,.70):new THREE.Vector3(.02,.04,.85);
  pos=target.clone().add(offset);
  $('inspection-name').textContent=`Tower ${t.id} · ${item.name}`;$('inspection-description').textContent='Equipment inspection';$('item-description').textContent=descriptions[item.name]||'Protected equipment in this tower enclosure.';
 }
 tweenTo(pos,target);
}
function leaveInspection(recapture=true){
 if(!inspection)return;inspection=null;$('inspection').hidden=true;aim=null;keys.clear();
 if(savedPose){camera.position.copy(savedPose.position);camera.quaternion.copy(savedPose.quaternion);transition=null;savedPose=null;}
 if(recapture)capture();else{paused=false;$('crosshair').hidden=false;}
}
function toggleCabinet(t,kind,close=false){const d=doorState(t,kind);if(close||d.open){d.open=false;d.target=0;notify(`Tower ${t.id} cabinet closed`);}else{d.open=true;d.target=-THREE.MathUtils.degToRad(105);notify(`Cabinet open. Press E again to inspect its contents.`);}}
function interact(){
 if(!ready||!started)return;
 if(inspection){if(aim?.userData.kind==='item')beginInspection('item',aim.userData.tower,aim.userData.item);return;}
 if(!aim)return;
 const {kind,tower:t,item}=aim.userData,state=towerState.get(t.id);
 if(kind==='gate'&&state.gate.open&&Math.abs(camera.position.x-t.center[0])<1.5&&Math.abs(camera.position.z-6)<.6){notify('Step clear of the gate before closing it.');return;}
 if(kind==='keypad')beginInspection('keypad',t);
 else if(kind==='gate'){if(!state.unlocked)beginInspection('keypad',t);else{state.gate.open=!state.gate.open;state.gate.target=state.gate.open?Math.PI/2:0;notify(state.gate.open?'Gate opening':'Gate closing');}}
 else if(kind==='service'||kind==='radio'){const d=state[kind];if(!d.open)toggleCabinet(t,kind);else beginInspection(kind,t);}
 else if(kind==='item')beginInspection('item',t,item);
}
function unlockGate(){
 if(inspection?.kind!=='keypad')return;
 const t=inspection.tower,state=towerState.get(t.id);
 if(!acceptsPin($('pin').value,manifest.demoPin)){$('pin-message').textContent='Incorrect PIN. Use 1234 for this demonstration.';$('pin').select();return;}
 state.unlocked=true;state.gate.open=true;state.gate.target=Math.PI/2;$('gate-state').textContent='Gate unlocked — opening';$('pin-message').textContent='Access granted. Return to exploration to enter.';$('gate-close').hidden=false;notify(`Tower ${t.id} gate unlocked`);
}
for(const digit of ['1','2','3','4','5','6','7','8','9','Clear','0','⌫']){const b=document.createElement('button');b.type='button';b.textContent=digit;b.setAttribute('aria-label',digit==='⌫'?'Delete last digit':digit);b.addEventListener('click',()=>{$('pin').value=digit==='Clear'?'':digit==='⌫'?$('pin').value.slice(0,-1):($('pin').value+digit).slice(0,6);});$('digits').append(b);}
$('start').addEventListener('click',start);$('resume').addEventListener('click',capture);$('back').addEventListener('click',()=>leaveInspection());$('unlock').addEventListener('click',unlockGate);
$('pin').addEventListener('input',()=>{$('pin').value=$('pin').value.replace(/\D/g,'');});$('pin').addEventListener('keydown',e=>{if(e.key==='Enter')unlockGate();});
$('gate-close').addEventListener('click',()=>{const state=towerState.get(inspection.tower.id);state.unlocked=false;state.gate.open=false;state.gate.target=0;$('gate-state').textContent='Gate locked';$('pin-message').textContent='Gate closing and locking.';$('gate-close').hidden=true;});
$('cabinet-close').addEventListener('click',()=>{const i=inspection;toggleCabinet(i.tower,i.kind,true);leaveInspection();});$('compartment-return').addEventListener('click',()=>beginInspection('service',inspection.tower));
$('fly').addEventListener('click',()=>setMode('fly'));$('walk').addEventListener('click',()=>setMode('walk'));
$('reset').addEventListener('click',()=>{if(!ready)return;if(inspection)leaveInspection(false);camera.position.set(0,EYE_HEIGHT,10);camera.lookAt(0,EYE_HEIGHT,0);setMode('walk',false);notify('Returned to the main entrance');});
$('help').addEventListener('click',()=>{controls.unlock();showPause();$('controls').showModal();});$('close-controls').addEventListener('click',()=>$('controls').close());
document.addEventListener('keydown',e=>{
 if(e.code==='Escape'){if(inspection){e.preventDefault();leaveInspection();}else if(started)showPause();return;}
 if(e.target instanceof HTMLInputElement||$('controls').open)return;
 if(e.code==='Digit0'){e.preventDefault();setMode('fly');}else if(e.code==='Digit1'){e.preventDefault();setMode('walk');}
 else if(e.code==='KeyE'&&!e.repeat){e.preventDefault();interact();}
 else if(e.code==='KeyR'&&!e.repeat&&aim&&['service','radio'].includes(aim.userData.kind)){toggleCabinet(aim.userData.tower,aim.userData.kind,true);}
 else if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Space','KeyC','ControlLeft'].includes(e.code)){e.preventDefault();keys.add(e.code);}
});document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();showPause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();showPause();}});
let drag=null;
renderer.domElement.addEventListener('pointerdown',e=>{if(!started||inspection)return;if(touch||!controls.isLocked){drag={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);paused=false;$('pause').hidden=true;}});
renderer.domElement.addEventListener('pointermove',e=>{
 pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);
 if(drag&&!inspection&&!controls.isLocked){const q=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');q.y-=(e.clientX-drag.x)*.004;q.x=THREE.MathUtils.clamp(q.x-(e.clientY-drag.y)*.004,-1.5,1.5);camera.quaternion.setFromEuler(q);drag={x:e.clientX,y:e.clientY};}
});renderer.domElement.addEventListener('pointerup',()=>drag=null);
if(touch){for(const b of document.querySelectorAll('[data-move]')){b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.move);});for(const ev of ['pointerup','pointercancel'])b.addEventListener(ev,()=>keys.delete(b.dataset.move));}$('touch-e').addEventListener('click',interact);}

function updateAim(){
 for(const p of proxies){const {kind,tower:t}=p.userData;
  p.visible=kind==='item'?Boolean(inspection&&inspection.tower.id===t.id&&towerState.get(t.id).service.open):!inspection;
 }
 raycaster.setFromCamera(inspection?pointer:new THREE.Vector2(0,0),camera);raycaster.far=inspection?5:4.5;
 const hit=raycaster.intersectObjects(proxies.filter(p=>p.visible),false)[0];aim=hit?.object||null;
 if(!inspection){$('target').hidden=!aim||paused;if(aim){const {kind,tower:t,name}=aim.userData;$('target-name').textContent=`Tower ${t.id} · ${name}`;const state=towerState.get(t.id);$('target-action').textContent=kind==='keypad'?'E Enter PIN':kind==='gate'?(state.unlocked?'E Open / close gate':'E Unlock with keypad'):state[kind]?.open?'E Inspect contents · R Close':'E Open cabinet';}}
}
function move(dt){
 if(!started||paused||inspection||transition)return;
 const forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
 camera.getWorldDirection(direction);if(mode==='walk'){direction.y=0;direction.normalize();}right.crossVectors(direction,up).normalize();
 const v=direction.clone().multiplyScalar(forward).addScaledVector(right,side);
 if(mode==='fly')v.y+=(keys.has('Space')?1:0)-(keys.has('KeyC')||keys.has('ControlLeft')?1:0);
 if(v.lengthSq()>1)v.normalize();const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight'))?(mode==='fly'?15:5):mode==='fly'?7:2.8;v.multiplyScalar(speed*dt);
 if(mode==='walk'){const p=moveWalker(camera.position,v.x,v.z,currentBoxes());camera.position.set(p.x,p.y,p.z);}else{camera.position.add(v);camera.position.y=THREE.MathUtils.clamp(camera.position.y,.85,90);camera.position.x=THREE.MathUtils.clamp(camera.position.x,-80,80);camera.position.z=THREE.MathUtils.clamp(camera.position.z,-65,65);}
}
function frame(){
 const dt=Math.min(clock.getDelta(),.04);
 for(const d of doors){const previous=d.angle;d.angle=THREE.MathUtils.damp(d.angle,d.target,6,dt);if(Math.abs(d.angle-d.target)<.0001)d.angle=d.target;d.node.rotation.y=d.angle;if(Math.abs(previous-d.angle)>.0001)renderer.shadowMap.needsUpdate=true;}
 scene.updateMatrixWorld();move(dt);
 if(transition){const t=transition;t.elapsed+=dt;const p=Math.min(1,t.elapsed/t.duration),e=1-(1-p)**3;camera.position.lerpVectors(t.from,t.to,e);camera.quaternion.copy(t.q0).slerp(t.q1,e);if(p===1){transition=null;t.onComplete?.();}}
 if(ready&&started)updateAim();renderer.render(scene,camera);requestAnimationFrame(frame);
}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

async function load(){try{
 const base=import.meta.env.BASE_URL;
 const response=await fetch(base+'assets/scene.json');if(!response.ok)throw new Error('Scene manifest could not be loaded');manifest=await response.json();
 const gltf=await new GLTFLoader().loadAsync(base+'assets/tower-campus.glb',event=>{$('loading').textContent=`Downloading tower geometry · ${(event.loaded/1048576).toFixed(1)} MB`;});model=gltf.scene;scene.add(model);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 for(const t of manifest.towers){const state={gate:makeDoor(t,'gate'),service:makeDoor(t,'service'),radio:makeDoor(t,'radio'),unlocked:false};towerState.set(t.id,state);
  proxy('keypad',t,t.keypad,[.34,.48,.20],'Gate keypad');keypadFace(t);
  proxy('gate',t,[t.center[0],1.2,6],[1.85,2.35,.13],'Access gate');
  proxy('service',t,[t.center[0]+2.69,1.33,.74],[1.08,1.94,.12],'Service compartment');
  proxy('radio',t,[t.center[0]+3.91,1.33,.74],[1.08,1.94,.12],'Telecommunications compartment');
  for(const item of t.items)proxy('item',t,item.position,item.size,item.name,item);
 }
 renderer.shadowMap.needsUpdate=true;ready=true;$('loading').textContent='Three compounds ready to explore.';$('start').disabled=false;$('start').textContent='Start walking';
 if(import.meta.env.DEV)window.walkthrough={camera,scene,model,manifest,towerState,proxies,controls,setMode,interact,beginInspection,unlockGate,get state(){return {ready,mode,inspection,paused,aim:aim?.userData,camera:camera.position.toArray()};}};
}catch(error){console.error(error);$('loading').textContent='The environment could not load. Check your connection and refresh the page.';$('start').disabled=false;$('start').textContent='Reload environment';$('start').onclick=()=>location.reload();}}
$('crosshair').hidden=true;
frame();load();
