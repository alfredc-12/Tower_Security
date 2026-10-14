import bpy, json, math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'public'/'assets'
S=bpy.context.scene
assert S.name=='THREE TOWERS | Local enclosure security'
for key in list(S.keys()):del S[key]
def coords(v):return [float(v[0]),float(v[2]),-float(v[1])]
def box(o):
    p=[o.matrix_world@Vector(v) for v in o.bound_box]
    lo=[min(v[i] for v in p) for i in range(3)];hi=[max(v[i] for v in p) for i in range(3)]
    return {'min':[lo[0],lo[2],-hi[1]],'max':[hi[0],hi[2],-lo[1]]}
def cube(name,location,dimensions,color):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location)
    o=bpy.context.object;o.name=name;o.dimensions=dimensions
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    m=bpy.data.materials.get(name+' material')
    if not m:
        m=bpy.data.materials.new(name+' material');m.use_nodes=True
        n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=.45
    m.diffuse_color=(*color,1)
    o.data.materials.append(m)
    return o

manifest={'version':1,'units':'metres','spawn':[0,1.72,10],'towers':[],'colliders':[],'source':'Three_Towers_Local_Security.blend','demoPin':'1234'}
dynamic=[]
for index,cx in [(1,-20),(2,0),(3,20)]:
    gate=bpy.data.objects['TS | T%d HINGED GATE - rotate Z to open'%index]
    gate.name='T%d_Gate_Pivot'%index;gate['interactive']='gate';gate['tower']=index
    service=bpy.data.objects['TS | T%d SERVICE DOOR - rotate Z to open'%index]
    service.name='T%d_Service_Pivot'%index;service['interactive']='service';service['tower']=index
    radio=bpy.data.objects['TS | T%d RADIO DOOR - rotate Z to open'%index]
    radio.name='T%d_Radio_Pivot'%index;radio['interactive']='radio';radio['tower']=index
    dynamic.extend([gate,service,radio])
    # The online demo uses PIN-controlled access, superseding the mechanical gate lock.
    for o in list(S.objects):
        if o.parent==gate and any(k in o.name for k in ['gate keyed','gate sliding','gate key ','gate padlock','gate lock cover']):
            bpy.data.objects.remove(o,do_unlink=True)
    cube('T%d_Keypad_Post'%index,(cx+1.27,-6.30,.82),(.12,.12,1.64),(.03,.07,.09))
    pad=cube('T%d_Keypad'%index,(cx+1.27,-6.395,1.30),(.25,.11,.38),(.055,.07,.075))
    pad['interactive']='keypad';pad['tower']=index
    cube('T%d_Keypad_Screen'%index,(cx+1.27,-6.455,1.414),(.19,.012,.07),(.055,.58,.33))
    for row in range(4):
        for col in range(3):
            cube('T%d_Keypad_Button_%d_%d'%(index,row,col),(cx+1.197+col*.073,-6.457,1.335-row*.052),(.045,.017,.034),(.43,.48,.50))
    tower={'id':index,'center':coords((cx,0,0)),'gate':gate.name,'service':service.name,'radio':radio.name,
        'keypad':[cx+1.27,1.30,6.395],
        'equipment':[cx+3.30,1.33,-.30],
        'serviceFocus':[cx+2.69,1.48,-.55],
        'items':[{'name':'CCTV recorder','position':[cx+2.69,1.70,-.77],'size':[.86,.16,.46]},
                 {'name':'Network and alert link','position':[cx+2.69,2.00,-.77],'size':[.83,.15,.45]},
                 {'name':'Intrusion alarm controller','position':[cx+2.69,1.36,-.88],'size':[.82,.23,.24]},
                 {'name':'Visitor logbook','position':[cx+2.69,1.15,.36],'size':[.51,.045,.33]},
                 {'name':'Backup battery compartment','position':[cx+2.69,.555,-.75],'size':[.85,.44,.68]}]}
    manifest['towers'].append(tower)

bpy.context.view_layer.update()
for o in S.objects:
    if o.type not in ['MESH','CURVE']:continue
    if o.parent in dynamic:continue
    # Architectural and equipment obstacles at pedestrian height. Fences get full panels.
    if o.get('walk_collision') or 'dense welded mesh' in o.name:
        bb=box(o)
        if bb['max'][1]>.10 and bb['min'][1]<1.90 and bb['max'][1]-bb['min'][1]<8:
            manifest['colliders'].append(bb)
for t in manifest['towers']:
    cx=t['center'][0]
    manifest['colliders'].append({'min':[cx+1.18,0,6.24],'max':[cx+1.36,1.70,6.52]})

# Convert text and curves, preserving the authored physical detail.
for o in list(S.objects):
    if o.type in ['CAMERA','LIGHT']:bpy.data.objects.remove(o,do_unlink=True)
for o in S.objects:
    if o.type=='CURVE':o.data.bevel_resolution=min(o.data.bevel_resolution,1);o.data.resolution_u=min(o.data.resolution_u,4)
    for m in o.modifiers:
        if m.type=='BEVEL':m.segments=min(m.segments,2)
bpy.ops.object.select_all(action='DESELECT')
for o in S.objects:
    if o.type in ['MESH','CURVE','FONT']:o.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in S.objects if o.type=='MESH')
bpy.ops.object.convert(target='MESH')
bpy.context.view_layer.update()

# Batch stationary geometry by material; hinge assemblies remain separately animated.
for mat in bpy.data.materials:
    if not mat.use_nodes:continue
    node=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    if node is None:continue
    for link in list(mat.node_tree.links):
        if link.to_node==node and link.to_socket in [node.inputs['Base Color'],node.inputs['Normal']]:mat.node_tree.links.remove(link)
    node.inputs['Base Color'].default_value=mat.diffuse_color
groups={}
for o in list(S.objects):
    if o.type!='MESH':continue
    if 'Keypad' in o.name and o.get('interactive')=='keypad':continue
    pivot=o.parent.name if o.parent in dynamic else 'STATIC'
    materials=tuple(m.name if m else '' for m in o.data.materials)
    groups.setdefault((pivot,materials),[]).append(o)
for n,((pivot,mats),objects) in enumerate(groups.items()):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:bpy.ops.object.join()
    o=bpy.context.object;o.name=pivot+'_Batch_%03d'%n

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'tower-campus.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False,export_materials='EXPORT',export_image_format='AUTO')
(OUT/'scene.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
print('WEB_EXPORT_OK '+json.dumps({'nodes':len(S.objects),'triangles':sum(len(o.data.polygons) for o in S.objects if o.type=='MESH'),'bytes':(OUT/'tower-campus.glb').stat().st_size,'colliders':len(manifest['colliders'])}))
