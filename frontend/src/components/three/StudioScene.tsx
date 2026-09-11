import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Formation } from '../../types';

interface StudioSceneProps {
  formations: Formation[];
  totalDepth: number;
  currentDepth: number;
  isDark?: boolean;
  showCasing?: boolean;
  showFormations?: boolean;
  showTrajectory?: boolean;
  showBHA?: boolean;
  wireframe?: boolean;
}

const SCALE = 1 / 400;

export default function StudioScene({
  formations,
  totalDepth,
  currentDepth,
  isDark = false,
  showCasing = true,
  showFormations = true,
  showTrajectory = true,
  showBHA = true,
  wireframe = false,
}: StudioSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  // Rebuild scene whenever props change
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth;
    const h = mount.clientHeight;

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);

    // ── Scene ───────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDark ? '#111110' : '#ECEAE3');

    // ── Camera ──────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 200);
    camera.position.set(6, -4, 8);
    camera.lookAt(0, -totalDepth * SCALE * 0.5, 0);

    // ── Lights ──────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, isDark ? 0.5 : 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, isDark ? 1.4 : 1.0);
    dir.position.set(8, 8, 8);
    scene.add(dir);
    const hem = new THREE.HemisphereLight(0xffffff, isDark ? 0x1C1C1A : 0xD6D3CB, 0.4);
    scene.add(hem);

    // ── Controls ────────────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, -totalDepth * SCALE * 0.4, 0);
    controls.update();

    const totalH = totalDepth * SCALE;

    // ── Formation layers ────────────────────────────────────────────────────
    if (showFormations) {
      formations.forEach((f) => {
        const fH = (f.bottomDepth - f.topDepth) * SCALE;
        const fY = -(f.topDepth + (f.bottomDepth - f.topDepth) / 2) * SCALE;
        const geo = new THREE.CylinderGeometry(0.55, 0.55, fH, 48);
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(f.color),
          roughness: 0.9,
          wireframe,
          transparent: true,
          opacity: wireframe ? 1 : 0.75,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = fY;
        scene.add(mesh);
      });
    }

    // ── Casing strings ──────────────────────────────────────────────────────
    if (showCasing) {
      const casingDepths = [
        { depth: totalDepth * 0.04, r: 0.52 },
        { depth: totalDepth * 0.18, r: 0.48 },
        { depth: totalDepth * 0.60, r: 0.42 },
        { depth: totalDepth * 0.92, r: 0.36 },
      ];
      casingDepths.forEach(({ depth, r }) => {
        const cH = depth * SCALE;
        const cGeo = new THREE.CylinderGeometry(r + 0.02, r + 0.02, cH, 32, 1, true);
        const cMat = new THREE.MeshStandardMaterial({
          color: isDark ? 0x5E5E58 : 0x9CA3AF,
          roughness: 0.4,
          metalness: 0.7,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          wireframe,
        });
        const cMesh = new THREE.Mesh(cGeo, cMat);
        cMesh.position.y = -cH / 2;
        scene.add(cMesh);
      });
    }

    // ── Trajectory curve ────────────────────────────────────────────────────
    if (showTrajectory) {
      const points: THREE.Vector3[] = [];
      for (let d = 0; d <= currentDepth; d += 50) {
        const t = d / totalDepth;
        const x = Math.sin(t * Math.PI * 0.6) * 0.8 * t;
        const z = Math.cos(t * Math.PI * 0.4) * 0.4 * t;
        points.push(new THREE.Vector3(x, -d * SCALE, z));
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeo = new THREE.TubeGeometry(curve, 120, 0.025, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0xC9A84C,
        roughness: 0.2,
        metalness: 0.6,
      });
      scene.add(new THREE.Mesh(tubeGeo, tubeMat));
    }

    // ── BHA at bit ──────────────────────────────────────────────────────────
    if (showBHA) {
      const bhaY = -currentDepth * SCALE;
      const bhaGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.3, 16);
      const bhaMat = new THREE.MeshStandardMaterial({
        color: 0xC9A84C,
        roughness: 0.2,
        metalness: 0.8,
      });
      const bha = new THREE.Mesh(bhaGeo, bhaMat);
      bha.position.y = bhaY;
      scene.add(bha);
    }

    // ── Grid ────────────────────────────────────────────────────────────────
    const grid = new THREE.GridHelper(
      12, 24,
      isDark ? 0x2E2E2B : 0xD6D3CB,
      isDark ? 0x252523 : 0xE8E6DF,
    );
    grid.position.y = 0;
    scene.add(grid);

    // ── Animate ─────────────────────────────────────────────────────────────
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // ── Resize ──────────────────────────────────────────────────────────────
    const onResize = () => {
      if (!mount) return;
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [formations, totalDepth, currentDepth, isDark, showCasing, showFormations, showTrajectory, showBHA, wireframe]);

  return <div ref={mountRef} className="three-canvas w-full h-full" />;
}
