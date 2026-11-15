// What stands between two points in town. The town's buildings, stalls and trees are a few big merged meshes (about
// two hundred thousand triangles), and asking three.js whether a sight line crosses them tests every triangle each
// time. This keeps the same triangles in a coarse grid over the ground, so a sight line is checked only against the
// ones near it. It answers one question: is anything in the way? (Used to place the camera for a conversation, and to
// find open ground.) Things that move (people, the bus) and things marked as never in the way are left out; a fix that
// isn't built yet is in the grid but skipped until it shows.
import * as THREE from 'three';

const CELL = 3;
export class OccGrid {
  // roots: scenes or groups to take meshes from. skip(o): true for a mesh to leave out.
  constructor(root, skip) {
    // (a mesh drawn many times over, like the trees, counts once for each place it's drawn, if it's marked occInst;
    // other such meshes, like falling leaves, are left out)
    const meshes = []; root.updateMatrixWorld(true);
    root.traverse((o) => { if (o.isMesh && (!o.isInstancedMesh || o.userData.occInst) && !o.isSkinnedMesh && o.geometry && o.geometry.attributes.position && !skip(o)) meshes.push(o); });
    const tris = (m) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3 | 0;
    let n = 0; for (const m of meshes) n += tris(m) * (m.isInstancedMesh ? m.count : 1);
    const tri = this.tri = new Float32Array(n * 9); this.owner = new Uint16Array(n); this.meshes = meshes; this.n = n;
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; let k = 0; const v = new THREE.Vector3(); const IM = new THREE.Matrix4(), WM = new THREE.Matrix4();
    meshes.forEach((m, mi) => {
      const pos = m.geometry.attributes.position, idx = m.geometry.index; const cnt = tris(m);
      for (let q = 0; q < (m.isInstancedMesh ? m.count : 1); q++) {
        let M = m.matrixWorld; if (m.isInstancedMesh) { m.getMatrixAt(q, IM); M = WM.multiplyMatrices(m.matrixWorld, IM); }
        for (let t = 0; t < cnt; t++) {
          for (let c = 0; c < 3; c++) { const i = idx ? idx.getX(t * 3 + c) : t * 3 + c; v.fromBufferAttribute(pos, i).applyMatrix4(M); tri[k * 9 + c * 3] = v.x; tri[k * 9 + c * 3 + 1] = v.y; tri[k * 9 + c * 3 + 2] = v.z; if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x; if (v.z < z0) z0 = v.z; if (v.z > z1) z1 = v.z; }
          this.owner[k] = mi; k++;
        }
      }
    });
    this.x0 = x0; this.z0 = z0; this.nx = Math.max(1, Math.ceil((x1 - x0) / CELL)); this.nz = Math.max(1, Math.ceil((z1 - z0) / CELL));
    // each triangle goes in every cell its footprint touches (a triangle bigger than a dozen cells is ground or sky:
    // it's kept in its own short list and always checked)
    const lists = Array.from({ length: this.nx * this.nz }, () => []); this.big = [];
    for (let t = 0; t < n; t++) {
      const o = t * 9; const ax = Math.min(tri[o], tri[o + 3], tri[o + 6]), bx = Math.max(tri[o], tri[o + 3], tri[o + 6]), az = Math.min(tri[o + 2], tri[o + 5], tri[o + 8]), bz = Math.max(tri[o + 2], tri[o + 5], tri[o + 8]);
      const i0 = this.ci(ax), i1 = this.ci(bx), j0 = this.cj(az), j1 = this.cj(bz);
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > 16) { this.big.push(t); continue; }
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) lists[j * this.nx + i].push(t);
    }
    this.cells = lists.map((a) => Int32Array.from(a)); this.stamp = new Uint32Array(n); this.tick = 0;
    this.vis = new Uint8Array(meshes.length);
  }
  ci(x) { return Math.min(this.nx - 1, Math.max(0, Math.floor((x - this.x0) / CELL))); }
  cj(z) { return Math.min(this.nz - 1, Math.max(0, Math.floor((z - this.z0) / CELL))); }
  // which meshes are showing right now (call once before a batch of questions)
  refresh() { this.meshes.forEach((m, i) => { let on = 1; for (let q = m; q; q = q.parent) if (!q.visible) { on = 0; break; } this.vis[i] = on; }); }
  // is anything on the line from (ox, oy, oz) toward (tx, ty, tz), between near and far along it (metres)?
  hit(ox, oy, oz, tx, ty, tz, near = 0, far = Infinity) {
    let dx = tx - ox, dy = ty - oy, dz = tz - oz; const len = Math.hypot(dx, dy, dz) || 1; dx /= len; dy /= len; dz /= len;
    far = Math.min(far, len); if (far <= near) return false;
    const ax = ox + dx * near, az = oz + dz * near, bx = ox + dx * far, bz = oz + dz * far;
    const i0 = this.ci(Math.min(ax, bx)), i1 = this.ci(Math.max(ax, bx)), j0 = this.cj(Math.min(az, bz)), j1 = this.cj(Math.max(az, bz));
    const sx = bx - ax, sz = bz - az; const sl = sx * sx + sz * sz || 1; const reach = CELL * 0.72; const tick = ++this.tick;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      // (only the cells the line passes through or beside)
      const cx = this.x0 + (i + 0.5) * CELL, cz = this.z0 + (j + 0.5) * CELL; let u = ((cx - ax) * sx + (cz - az) * sz) / sl; u = u < 0 ? 0 : u > 1 ? 1 : u;
      if (Math.hypot(cx - (ax + sx * u), cz - (az + sz * u)) > reach) continue;
      const list = this.cells[j * this.nx + i];
      for (let q = 0; q < list.length; q++) { const t = list[q]; if (this.stamp[t] === tick) continue; this.stamp[t] = tick; if (this.vis[this.owner[t]] && this.cross(t, ox, oy, oz, dx, dy, dz, near, far)) return true; }
    }
    for (const t of this.big) if (this.vis[this.owner[t]] && this.cross(t, ox, oy, oz, dx, dy, dz, near, far)) return true;
    return false;
  }
  // a line and one triangle, either face (Möller and Trumbore's test)
  cross(t, ox, oy, oz, dx, dy, dz, near, far) {
    const T = this.tri, o = t * 9;
    const e1x = T[o + 3] - T[o], e1y = T[o + 4] - T[o + 1], e1z = T[o + 5] - T[o + 2], e2x = T[o + 6] - T[o], e2y = T[o + 7] - T[o + 1], e2z = T[o + 8] - T[o + 2];
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x; const det = e1x * px + e1y * py + e1z * pz;
    if (det > -1e-9 && det < 1e-9) return false; const inv = 1 / det;
    const sx = ox - T[o], sy = oy - T[o + 1], sz = oz - T[o + 2]; const u = (sx * px + sy * py + sz * pz) * inv; if (u < 0 || u > 1) return false;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x; const w = (dx * qx + dy * qy + dz * qz) * inv; if (w < 0 || u + w > 1) return false;
    const d = (e2x * qx + e2y * qy + e2z * qz) * inv; return d >= near && d <= far;
  }
}
