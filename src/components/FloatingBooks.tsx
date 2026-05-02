import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

const Book = ({ position, rotation, scale, color }: { position: [number, number, number], rotation: [number, number, number], scale: number, color: string }) => {
  const mesh = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.x += 0.001;
      mesh.current.rotation.y += 0.002;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={1} floatIntensity={2}>
      <group position={position} rotation={rotation} scale={scale} ref={mesh}>
        {/* Book Cover */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1, 1.4, 0.2]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* Pages (White side) */}
        <mesh position={[0.05, 0, 0]}>
          <boxGeometry args={[0.95, 1.35, 0.18]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        {/* Book Spine Detail */}
        <mesh position={[-0.45, 0, 0]}>
          <boxGeometry args={[0.1, 1.4, 0.22]} />
          <meshStandardMaterial color={color} roughness={0.3} metalness={0.8} />
        </mesh>
      </group>
    </Float>
  );
};

export const FloatingBooks = () => {
  const books = useMemo(() => {
    const colors = ['#7c3aed', '#a78bfa', '#5b21b6', '#c084fc', '#4c1d95'];
    return Array.from({ length: 15 }).map((_, i) => ({
      position: [
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 10 - 5
      ] as [number, number, number],
      rotation: [
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      ] as [number, number, number],
      scale: 0.2 + Math.random() * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] opacity-40">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 10]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
        
        {books.map((props, i) => (
          <Book key={i} {...props} />
        ))}
      </Canvas>
    </div>
  );
};
