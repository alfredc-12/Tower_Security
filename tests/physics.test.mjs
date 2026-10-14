import test from 'node:test';
import assert from 'node:assert/strict';
import {moveWalker,safeWalkingPosition,acceptsPin,EYE_HEIGHT} from '../src/physics.js';
const fence={min:[-2,0,5.97],max:[2,2.4,6.03]};
test('walking cannot tunnel through a closed gate even on a slow frame',()=>{const p=moveWalker({x:0,y:12,z:10},0,-8,[fence]);assert.ok(p.z>6.28);assert.equal(p.y,EYE_HEIGHT);});
test('walking slides along a wall and stays at eye height',()=>{const p=moveWalker({x:0,z:7},1.5,-2,[fence]);assert.ok(p.x>1);assert.ok(p.z>6.28);assert.equal(p.y,EYE_HEIGHT);});
test('switching to walking from inside an obstacle finds a clear position',()=>{const p=safeWalkingPosition({x:0,y:40,z:6},[fence]);assert.ok(p.z>6.31||p.z<5.69||Math.abs(p.x)>2.28);assert.equal(p.y,EYE_HEIGHT);});
test('leaving the flight boundary safely returns to the entrance',()=>{assert.deepEqual(safeWalkingPosition({x:1000,z:1000},[fence]),{x:0,y:EYE_HEIGHT,z:10});});
test('only the full demo PIN is accepted',()=>{for(const pin of ['','123','01234','9999','1234a'])assert.equal(acceptsPin(pin),false);assert.equal(acceptsPin('1234'),true);});
