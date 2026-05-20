import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { Structure } from '../api/types'
import type { CrystalData, LatticeParams } from '../utils/cifParser'
import { fractionalToCartesian, getLatticeVectors } from '../utils/cifParser'
import { getElementProps } from '../utils/elementData'

interface CrystalViewer3DProps {
  structure: Structure
}

interface AtomSphereProps {
  position: [number, number, number]
  element: string
  radiusScale: number
}

interface UnitCellProps {
  lattice: LatticeParams
  supercell: number
}

interface ViewerControlsProps {
  supercell: number
  onSupercellChange: (value: number) => void
  atomSize: number
  onAtomSizeChange: (value: number) => void
}

// Control panel component
function ViewerControls({
  supercell,
  onSupercellChange,
  atomSize,
  onAtomSizeChange,
}: ViewerControlsProps) {
  return (
    <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-4 rounded-lg bg-surface/90 px-4 py-3 backdrop-blur-sm">
      {/* Supercell slider */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-text-muted">Supercell</label>
        <input
          type="range"
          min={1}
          max={6}
          step={1}
          value={supercell}
          onChange={(e) => onSupercellChange(Number(e.target.value))}
          className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-surface-raised accent-accent"
        />
        <span className="min-w-[3ch] text-xs text-text-muted">
          {supercell}×{supercell}×{supercell}
        </span>
      </div>

      {/* Atom size slider */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-text-muted">Atom Size</label>
        <input
          type="range"
          min={0.2}
          max={1.5}
          step={0.1}
          value={atomSize}
          onChange={(e) => onAtomSizeChange(Number(e.target.value))}
          className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-surface-raised accent-accent"
        />
        <span className="min-w-[3ch] text-xs text-text-muted">{atomSize.toFixed(1)}</span>
      </div>
    </div>
  )
}

// Atom component - renders a single atom as a sphere
function AtomSphere({ position, element, radiusScale }: AtomSphereProps) {
  const { color, radius } = getElementProps(element)
  const meshRef = useRef<THREE.Mesh>(null)

  // Scale radius for visualization (covalent radii are in Angstroms)
  const visualRadius = radius * radiusScale

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[visualRadius, 24, 24]} />
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
    </mesh>
  )
}

// Unit cell wireframe component - shows the original unit cell
function UnitCell({ lattice, supercell }: UnitCellProps) {
  const geometry = useMemo(() => {
    const [va, vb, vc] = getLatticeVectors(lattice)

    const vertices: number[] = []
    const addEdge = (v1: THREE.Vector3, v2: THREE.Vector3) => {
      vertices.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z)
    }

    // Draw grid lines for the supercell
    for (let i = 0; i <= supercell; i++) {
      for (let j = 0; j <= supercell; j++) {
        // Lines along a-direction
        const startA = new THREE.Vector3(
          i * va.x + j * vb.x,
          i * va.y + j * vb.y,
          i * va.z + j * vb.z
        )
        const endA = new THREE.Vector3(
          i * va.x + j * vb.x + supercell * vc.x,
          i * va.y + j * vb.y + supercell * vc.y,
          i * va.z + j * vb.z + supercell * vc.z
        )
        addEdge(startA, endA)

        // Lines along b-direction
        const startB = new THREE.Vector3(
          i * va.x + j * vc.x,
          i * va.y + j * vc.y,
          i * va.z + j * vc.z
        )
        const endB = new THREE.Vector3(
          i * va.x + j * vc.x + supercell * vb.x,
          i * va.y + j * vc.y + supercell * vb.y,
          i * va.z + j * vc.z + supercell * vb.z
        )
        addEdge(startB, endB)

        // Lines along c-direction
        const startC = new THREE.Vector3(
          i * vb.x + j * vc.x,
          i * vb.y + j * vc.y,
          i * vb.z + j * vc.z
        )
        const endC = new THREE.Vector3(
          i * vb.x + j * vc.x + supercell * va.x,
          i * vb.y + j * vc.y + supercell * va.y,
          i * vb.z + j * vc.z + supercell * va.z
        )
        addEdge(startC, endC)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    return geo
  }, [lattice, supercell])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#00ffff" opacity={0.4} transparent />
    </lineSegments>
  )
}

// Component to center the camera on the crystal
function CameraController({
  crystalData,
  supercell,
}: {
  crystalData: CrystalData
  supercell: number
}) {
  const { camera } = useThree()

  useEffect(() => {
    if (!crystalData) return

    // Calculate the center of the supercell
    const [va, vb, vc] = getLatticeVectors(crystalData.lattice)
    const center = new THREE.Vector3(
      ((va.x + vb.x + vc.x) * supercell) / 2,
      ((va.y + vb.y + vc.y) * supercell) / 2,
      ((va.z + vb.z + vc.z) * supercell) / 2
    )

    // Calculate the bounding box size of the supercell
    const maxDim =
      Math.max(crystalData.lattice.a, crystalData.lattice.b, crystalData.lattice.c) * supercell

    // Position camera to see the whole crystal
    const distance = maxDim * 1.8
    camera.position.set(center.x + distance, center.y + distance * 0.5, center.z + distance)
    camera.lookAt(center)
  }, [crystalData, supercell, camera])

  return null
}

// Main 3D scene component
function CrystalScene({
  crystalData,
  supercell,
  atomSize,
}: {
  crystalData: CrystalData
  supercell: number
  atomSize: number
}) {
  const groupRef = useRef<THREE.Group>(null)

  // Generate supercell atoms by replicating the unit cell
  const atomPositions = useMemo(() => {
    const positions: { position: [number, number, number]; element: string }[] = []

    // Iterate over supercell grid
    for (let ia = 0; ia < supercell; ia++) {
      for (let ib = 0; ib < supercell; ib++) {
        for (let ic = 0; ic < supercell; ic++) {
          // For each atom in the original unit cell
          for (const atom of crystalData.atoms) {
            // Add the supercell offset to fractional coordinates
            const fracX = atom.x + ia
            const fracY = atom.y + ib
            const fracZ = atom.z + ic

            // Convert to Cartesian
            const cart = fractionalToCartesian(
              { x: fracX, y: fracY, z: fracZ },
              crystalData.lattice
            )

            positions.push({
              position: [cart.x, cart.y, cart.z],
              element: atom.element,
            })
          }
        }
      }
    }

    return positions
  }, [crystalData, supercell])

  // Calculate the center for orbiting
  const center = useMemo(() => {
    const [va, vb, vc] = getLatticeVectors(crystalData.lattice)
    return new THREE.Vector3(
      ((va.x + vb.x + vc.x) * supercell) / 2,
      ((va.y + vb.y + vc.y) * supercell) / 2,
      ((va.z + vb.z + vc.z) * supercell) / 2
    )
  }, [crystalData.lattice, supercell])

  return (
    <group ref={groupRef}>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 10]} intensity={1} />
      <directionalLight position={[-10, -10, -10]} intensity={0.4} />
      <directionalLight position={[0, 10, 0]} intensity={0.3} />

      {/* Unit cell wireframe */}
      <UnitCell lattice={crystalData.lattice} supercell={supercell} />

      {/* Atoms */}
      {atomPositions.map((atom, idx) => (
        <AtomSphere
          key={idx}
          position={atom.position}
          element={atom.element}
          radiusScale={atomSize}
        />
      ))}

      {/* Camera and controls */}
      <CameraController crystalData={crystalData} supercell={supercell} />
      <OrbitControls target={center} enableDamping dampingFactor={0.05} />
    </group>
  )
}

// Placeholder when no crystal data is available
function PlaceholderView({ formula }: { formula: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="text-4xl">🔮</div>
      <p className="mt-4 text-lg font-medium text-text-muted">3D Crystal Viewer</p>
      <p className="mt-2 text-sm text-text-dim">
        Upload a CIF file to view the crystal structure
      </p>
      <p className="mt-4 rounded bg-surface-raised/50 px-3 py-1 text-xs text-text-muted">{formula}</p>
    </div>
  )
}

// Main component
export function CrystalViewer3D({ structure }: CrystalViewer3DProps) {
  const [supercell, setSupercell] = useState(2) // Default to 2x2x2
  const [atomSize, setAtomSize] = useState(0.6) // Default atom size scale

  const hasCrystalData = structure.crystalData && structure.crystalData.atoms.length > 0

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-surface to-surface-raised">
      {hasCrystalData ? (
        <>
          <Canvas>
            <color attach="background" args={['#0f172a']} />
            <PerspectiveCamera makeDefault fov={50} near={0.1} far={1000} />
            <CrystalScene
              crystalData={structure.crystalData!}
              supercell={supercell}
              atomSize={atomSize}
            />
          </Canvas>
          <ViewerControls
            supercell={supercell}
            onSupercellChange={setSupercell}
            atomSize={atomSize}
            onAtomSizeChange={setAtomSize}
          />
        </>
      ) : (
        <PlaceholderView formula={structure.formula} />
      )}
    </div>
  )
}
