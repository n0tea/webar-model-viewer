"""Export the opened gearbox .blend without saving or modifying the source file.

Run: blender --background --disable-autoexec SOURCE.blend --python scripts/blender/export_gearbox.py -- OUTPUT.glb
"""
import bpy
import json
import struct
import sys
from pathlib import Path

output = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
from mathutils import Matrix
# Fix invalid mesh data in the in-memory copy only; the original .blend is never saved.
repaired = []
for obj in scene.objects:
    if obj.type == 'MESH':
        obj.data = obj.data.copy()
        if obj.data.validate(verbose=False, clean_customdata=False):
            repaired.append(obj.name)
# Reference transforms for checking synchronization after browser loading.
conversion = Matrix.Rotation(-3.141592653589793 / 2, 4, 'X')
reference = {'fps': scene.render.fps / scene.render.fps_base, 'samples': []}
for frame in [1, 300, 600, 900, 1200]:
    scene.frame_set(frame)
    reference['samples'].append({'frame': frame, 'positions': {
        obj.name: list((conversion @ obj.matrix_world).translation)
        for obj in scene.objects if obj.type == 'MESH'
    }})
if '--reference' in sys.argv:
    reference_path = Path(sys.argv[sys.argv.index('--reference') + 1])
    reference_path.write_text(json.dumps(reference, ensure_ascii=False), encoding='utf-8')
scene.frame_set(scene.frame_start)
# Export all 50 object actions on the same scene timeline, not as unrelated clips.
result = bpy.ops.export_scene.gltf(
    filepath=str(output),
    export_format='GLB',
    export_animations=True,
    export_animation_mode='SCENE',
    export_anim_scene_split_object=False,
    export_frame_range=True,
    export_frame_step=1,
    export_force_sampling=True,
    export_anim_slide_to_zero=True,
    export_current_frame=True,
    export_apply=True,
    export_cameras=False,
    export_lights=False,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
)
assert result == {'FINISHED'}, result
# Give the exported scene animation a user-facing name; binary mesh data is untouched.
data = output.read_bytes()
json_size = struct.unpack_from('<I', data, 12)[0]
doc = json.loads(data[20:20+json_size])
assert len(doc.get('animations', [])) == 1, 'Expected a single synchronized scene animation'
doc['animations'][0]['name'] = 'Сборка редуктора'
encoded = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
encoded += b' ' * (-len(encoded) % 4)
remaining = data[20+json_size:]
output.write_bytes(struct.pack('<III', 0x46546C67, 2, 20+len(encoded)+len(remaining)) + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded + remaining)
print('EXPORT_RESULT', json.dumps({'path': str(output), 'bytes': output.stat().st_size, 'clips': len(doc['animations']), 'channels': len(doc['animations'][0]['channels']), 'nodes': len(doc.get('nodes', [])), 'meshes': len(doc.get('meshes', [])), 'materials': len(doc.get('materials', [])), 'extensions': doc.get('extensionsUsed', [])}, ensure_ascii=False))
print('REPAIRED_MESHES', repaired)
