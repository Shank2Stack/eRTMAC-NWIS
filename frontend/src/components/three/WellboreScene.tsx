import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Formation } from '../../types';

interface WellboreSceneProps {
  formations: Formation[];
  currentDepth: number;
  totalDepth: number;
  isDark?: boolean;
}

// Scale: 1 THREE unit = 500 ft
const SCALE = 1 / 500;

function lithologyToColor(f: Formation, isDark: boolean): number {
  const colorMap: Record<string, string> = {
    sandstone:  '#C9A460',
    shale:      isDark ? '#4A4A45' : '#7D6E56',
    limestone:  '#8FA8B8',
    dolomite:   '#9CA3AF',
    salt:       isDark ? '#5A5A55' : '#E5E7EB',
    anhydrite:  '#C4A882',
  };
  return parseInt((colorMap[f.lithology] ?? '#888').replace('#', ''), 16);
}

export default function WellboreScene({
  formations,
  currentDepth,
  totalDepth,
  isDark = false,
}: WellboreSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth;
    const h = mount.clientHeight;

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    // ── Scene ───────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDark ? '#1C1C1A' : '#F5F4F0');
    scene.fog = new THREE.Fog(isDark ? '#1C1C1A' : '#F5F4F0', 20, 50);

    // ── Camera ──────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.01, 100);
    camera.position.set(4, -3, 6);
    camera.lookAt(0, -totalDepth * SCALE * 0.5, 0);

    // ── Lights ──────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, isDark ? 0.6 : 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, isDark ? 1.2 : 1.0);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    // ── Controls ────────────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, -totalDepth * SCALE * 0.5, 0);
    controls.update();

    // ── Wellbore outer shell (transparent) ─────────────────────────────────
    const totalH = totalDepth * SCALE;
    const wellGeo = new THREE.CylinderGeometry(0.28, 0.28, totalH, 32, 1, true);
    const wellMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x3A3A36 : 0xD6D3CB,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
    });
    const wellMesh = new THREE.Mesh(wellGeo, wellMat);
    wellMesh.position.y = -totalH / 2;
    scene.add(wellMesh);

    // ── Formation layers ────────────────────────────────────────────────────
    formations.forEach((f) => {
      const fH = (f.bottomDepth - f.topDepth) * SCALE;
      const fY = -(f.topDepth + (f.bottomDepth - f.topDepth) / 2) * SCALE;

      const geo = new THREE.CylinderGeometry(0.28, 0.28, fH, 32);
      const mat = new THREE.MeshStandardMaterial({
        color: lithologyToColor(f, isDark),
        roughness: 0.85,
        metalness: 0.05,
        transparent: true,
        opacity: 0.82,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = fY;
      scene.add(mesh);

      // Thin border ring at top of each formation
      const ringGeo = new THREE.TorusGeometry(0.285, 0.008, 8, 32);
      const ringMat = new THREE.MeshStandardMaterial({
        color: isDark ? 0x2E2E2B : 0xB8B4A8,
        roughness: 1,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = fY + fH / 2;
      scene.add(ring);
    });

    // ── Drillstring ─────────────────────────────────────────────────────────
    const drillH = currentDepth * SCALE;
    const drillGeo = new THREE.CylinderGeometry(0.04, 0.04, drillH, 16);
    const drillMat = new THREE.MeshStandardMaterial({
      color: 0xC9A84C,
      roughness: 0.3,
      metalness: 0.6,
    });
    const drillMesh = new THREE.Mesh(drillGeo, drillMat);
    drillMesh.position.y = -drillH / 2;
    scene.add(drillMesh);

    // ── Drill bit ───────────────────────────────────────────────────────────
    const bitGeo = new THREE.ConeGeometry(0.08, 0.15, 16);
    const bitMat = new THREE.MeshStandardMaterial({
      color: 0xC9A84C,
      roughness: 0.2,
      metalness: 0.8,
    });
    const bitMesh = new THREE.Mesh(bitGeo, bitMat);
    bitMesh.position.y = -drillH - 0.075;
    bitMesh.rotation.z = Math.PI;
    scene.add(bitMesh);

    // ── Depth marker lines ──────────────────────────────────────────────────
    const markerInterval = 1000; // ft
    for (let d = 0; d <= totalDepth; d += markerInterval) {
      const y = -d * SCALE;
      const points = [
        new THREE.Vector3(-0.5, y, 0),
        new THREE.Vector3(0.5, y, 0),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: isDark ? 0x4A4A45 : 0xB8B4A8,
        transparent: true,
        opacity: 0.5,
      });
      scene.add(new THREE.Line(lineGeo, lineMat));
    }

    // ── Grid helper ─────────────────────────────────────────────────────────
    const grid = new THREE.GridHelper(10, 20, isDark ? 0x2E2E2B : 0xD6D3CB, isDark ? 0x252523 : 0xECEAE3);
    grid.position.y = 0.01;
    grid.rotation.x = Math.PI / 2;
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
  }, [formations, currentDepth, totalDepth, isDark]);

  return <div ref={mountRef} className="three-canvas w-full h-full" />;
}
