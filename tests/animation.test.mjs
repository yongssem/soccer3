import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as RealThree from '../public/vendor/three.module.min.js';
const source = fs.readFileSync(new URL('../public/arena3d.js', import.meta.url),'utf8')
  .replace(/^import .*?;\s*/m,'').replace('export function createArena','function createArena');
let callback, scene, camera, disposed = 0;
class Renderer {
  constructor() { this.shadowMap={}; }
  setPixelRatio() {} setSize() {}
  render(s,c) { scene=s; camera=c; s.updateMatrixWorld(true); }
  dispose() { disposed++; } forceContextLoss() {}
}
const THREE = {...RealThree, WebGLRenderer:Renderer};
const document = {createElement:()=>({width:0,height:0,getContext:()=>({fillText(){}})})};
const ResizeObserver = class { observe() {} disconnect() {} };
const make = new Function('THREE','document','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','window','performance',source+';return createArena;')(
  THREE,document,ResizeObserver,fn=>(callback=fn,1),()=>{}, {devicePixelRatio:1}, {now:()=>0});
const results=[];
for (const [width,height] of [[683,850],[422,390],[390,422],[320,370]]) {
  for(const role of ['kicker','keeper']) {
    const frame={style:{}};
    const arena=make([{canvas:{getBoundingClientRect:()=>({width,height})},frame,role}]);
    callback(0);
    const humanoids=['shooter','goalkeeper'].map(name=>{
      const o=scene.getObjectByName(name);
      const size = new RealThree.Box3().setFromObject(o).getSize(new RealThree.Vector3());
      assert(size.y>1.7 && size.y<2.05, `${name} height ${size.y}`);
      return {name,height:+size.y.toFixed(3)};
    });
    const left=parseFloat(frame.style.left),top=parseFloat(frame.style.top);
    const w=parseFloat(frame.style.width),h=parseFloat(frame.style.height);
    assert(left>=0 && left+w<=width, 'goal horizontally clipped');
    assert(top>=0 && top+h<=height, 'goal vertically clipped');
    assert(Number.isFinite(camera.fov));
    const shooterBounds=new RealThree.Box3().setFromObject(scene.getObjectByName('shooter'));
    for(const x of [shooterBounds.min.x,shooterBounds.max.x]) for(const y of [shooterBounds.min.y,shooterBounds.max.y]) for(const z of [shooterBounds.min.z,shooterBounds.max.z]) {
      const projected=new RealThree.Vector3(x,y,z).project(camera);
      assert(Math.abs(projected.x)<=1 && Math.abs(projected.y)<=1,'run-up starting pose clipped');
    }
    const animation=arena.play({x:.7,y:.6},{x:-.6,y:.5},'goal');
    for(const time of [0,240,700,920,1080,1200,1450,2050,2490]) callback(time);
    await animation;
    scene.traverse(o=>assert([o.position.x,o.position.y,o.position.z,o.rotation.x,o.rotation.y,o.rotation.z].every(Number.isFinite)));
    arena.dispose();
    results.push({viewport:[width,height],role,humanoids,goalFits:true,animation:'completed'});
  }
}
assert.equal(disposed,8);
const jumpChecks=[];
for(const target of [{x:0,y:.9},{x:-.6,y:.9},{x:.6,y:.9},{x:0,y:.15}]) {
  const arena=make([{canvas:{getBoundingClientRect:()=>({width:683,height:850})},frame:{style:{}},role:'kicker'}]);
  callback(0);
  const keeper=scene.getObjectByName('goalkeeper');
  const head=keeper.children[0].children.find(o=>o.type==='Group' && Math.abs(o.position.y-1.705)<.001);
  const animation=arena.play(target,target,'save');
  callback(1340);
  assert(keeper.children[0].position.y<-.15, 'must crouch before jumping');
  callback(2050);
  const headY=head.getWorldPosition(new RealThree.Vector3()).y;
  const palms=['left-glove','right-glove'].map(name=>scene.getObjectByName(name).getWorldPosition(new RealThree.Vector3()).y);
  if(target.y>.65) {
    assert(keeper.position.y>.25, 'high shot must lift both feet');
    assert(palms.every(y=>y>headY), 'both gloves must reach above the head');
  } else assert(keeper.position.y<=.04, 'low shot should stay low');
  jumpChecks.push({target,jumpHeight:+keeper.position.y.toFixed(3),headY:+headY.toFixed(3),gloveY:palms.map(y=>+y.toFixed(3))});
  callback(2490); await animation;
  assert(Math.abs(keeper.position.y)<.001,'must land');
  arena.dispose();
}
const gaitChecks=[];
for(const shot of [{x:0,y:.5},{x:.8,y:.9},{x:-.8,y:.2}]) {
  const arena=make([{canvas:{getBoundingClientRect:()=>({width:683,height:850})},frame:{style:{}},role:'kicker'}]);
  callback(0);
  const shooter=scene.getObjectByName('shooter'), ball=scene.getObjectByName('match-ball');
  const leftBoot=shooter.getObjectByName('left-boot'), rightBoot=shooter.getObjectByName('right-boot');
  const leftKnee=shooter.getObjectByName('left-knee');
  let strikes=0, plantError=0, lowestSole=0, contactDistance=0, maxJointStep=0, maxJointAt=0, maxJointName="", previous=null;
  const animation=arena.play(shot,{x:0,y:.5},'goal',()=>strikes++);
  for(let time=0;time<=2490;time+=10) {
    callback(time);
    if(time<1200) { assert.equal(strikes,0); assert.equal(ball.position.z,11,'ball must wait for the foot'); }
    if(time===1200) contactDistance=shooter.getObjectByName('right-instep').getWorldPosition(new RealThree.Vector3()).distanceTo(ball.position);
    if(time>=920 && time<=1550) plantError=Math.max(plantError,leftKnee.localToWorld(new RealThree.Vector3(0,-.44,0)).distanceTo(new RealThree.Vector3(.27,.105,11.05)));
    for(const boot of [leftBoot,rightBoot]) lowestSole=Math.min(lowestSole,new RealThree.Box3().setFromObject(boot).min.y);
    const joints=['left-hip','left-knee','right-hip','right-knee'].map(name=>shooter.getObjectByName(name));
    if(previous) joints.forEach((joint,i)=>{const angle=previous[i].angleTo(joint.quaternion);if(angle>maxJointStep){maxJointStep=angle;maxJointAt=time;maxJointName=joint.name;}});
    previous=joints.map(joint=>joint.quaternion.clone());
  }
  await animation;
  assert.equal(strikes,1,'one kick sound per shot');
  assert(plantError<.001,"planted foot slides"); assert(lowestSole>=-.005,"boot penetrates grass"); assert(Math.abs(contactDistance-.17)<.005,"foot does not touch ball surface"); assert(maxJointStep<.18,"leg snaps between frames"); gaitChecks.push({shot,plantError,lowestSole,contactDistance,maxJointStep,maxJointAt,maxJointName});
  arena.dispose();
}
console.log(JSON.stringify({checks:results,jumpChecks,gaitChecks,disposed},null,2));
