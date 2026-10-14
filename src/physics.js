export const EYE_HEIGHT=1.78;
export const RADIUS=.28;
export function blocked(x,z,boxes,radius=RADIUS){return boxes.some(b=>b.max[1]>.15&&b.min[1]<1.95&&x>b.min[0]-radius&&x<b.max[0]+radius&&z>b.min[2]-radius&&z<b.max[2]+radius);}
export function moveWalker(position,dx,dz,boxes){
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.10));
 let x=position.x,z=position.z;
 for(let i=0;i<steps;i++){
  const nx=Math.max(-36,Math.min(36,x+dx/steps));if(!blocked(nx,z,boxes))x=nx;
  const nz=Math.max(-20,Math.min(20,z+dz/steps));if(!blocked(x,nz,boxes))z=nz;
 }
 return {x,y:EYE_HEIGHT,z};
}
export function safeWalkingPosition(position,boxes,spawn={x:0,z:10}){
 if(!blocked(position.x,position.z,boxes)&&Math.abs(position.x)<36&&Math.abs(position.z)<20)return {x:position.x,y:EYE_HEIGHT,z:position.z};
 for(let r=.5;r<8;r+=.5)for(let a=0;a<Math.PI*2;a+=Math.PI/8){const x=position.x+Math.cos(a)*r,z=position.z+Math.sin(a)*r;if(Math.abs(x)<36&&Math.abs(z)<20&&!blocked(x,z,boxes))return {x,y:EYE_HEIGHT,z};}
 return {x:spawn.x,y:EYE_HEIGHT,z:spawn.z};
}
export function acceptsPin(value,expected='1234'){return /^\d{4}$/.test(value)&&value===expected;}
