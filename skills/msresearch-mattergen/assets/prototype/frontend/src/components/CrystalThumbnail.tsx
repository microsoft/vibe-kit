import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { CrystalData, LatticeParams } from '../utils/cifParser'
import { fractionalToCartesian, getLatticeVectors } from '../utils/cifParser'
import { getElementProps } from '../utils/elementData'

// In-memory cache for generated thumbnails
const thumbnailCache = new Map<string, string>()

interface CrystalThumbnailProps {
  crystalData?: CrystalData
  structureId: string
}

// Skeleton shimmer animation component
function SkeletonShimmer() {
  return (
    <div className="h-full w-full animate-pulse rounded bg-gradient-to-r from-surface via-surface-raised to-surface bg-[length:200%_100%]">
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .animate-pulse {
          animation: shimmer 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

// Placeholder when no crystal data is available
function Placeholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-surface-raised/50">
      <div className="text-text-dim">
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      </div>
    </div>
  )
}

// Simplified atom sphere for thumbnails (lower geometry detail)
function ThumbnailAtom({
  position,
  element,
  radiusScale,
}: {
  position: [number, number, number]
  element: string
  radiusScale: number
}) {
  const { color, radius } = getElementProps(element)
  const visualRadius = radius * radiusScale

  return (
    <mesh position={position}>
      <sphereGeometry args={[visualRadius, 16, 16]} />
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
    </mesh>
  )
}

// Simplified unit cell for thumbnails
function ThumbnailUnitCell({ lattice }: { lattice: LatticeParams }) {
  const geometry = useMemo(() => {
    const [vaRaw, vbRaw, vcRaw] = getLatticeVectors(lattice)
    const va = new THREE.Vector3(vaRaw.x, vaRaw.y, vaRaw.z)
    const vb = new THREE.Vector3(vbRaw.x, vbRaw.y, vbRaw.z)
    const vc = new THREE.Vector3(vcRaw.x, vcRaw.y, vcRaw.z)

    const vertices: number[] = []
    const addEdge = (v1: THREE.Vector3, v2: THREE.Vector3) => {
      vertices.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z)
    }

    // Just draw the basic unit cell edges
    const origin = new THREE.Vector3(0, 0, 0)
    const a = va.clone()
    const b = vb.clone()
    const c = vc.clone()
    const ab = va.clone().add(vb)
    const ac = va.clone().add(vc)
    const bc = vb.clone().add(vc)
    const abc = va.clone().add(vb).add(vc)

    // Bottom face
    addEdge(origin, a)
    addEdge(origin, b)
    addEdge(a, ab)
    addEdge(b, ab)

    // Top face
    addEdge(c, ac)
    addEdge(c, bc)
    addEdge(ac, abc)
    addEdge(bc, abc)

    // Vertical edges
    addEdge(origin, c)
    addEdge(a, ac)
    addEdge(b, bc)
    addEdge(ab, abc)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    return geo
  }, [lattice])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#00ffff" opacity={0.3} transparent />
    </lineSegments>
  )
}

// Scene that renders and captures the thumbnail
function CaptureScene({
  crystalData,
  onCapture,
}: {
  crystalData: CrystalData
  onCapture: (dataUrl: string) => void
}) {
  const { gl, scene, camera } = useThree()
  const capturedRef = useRef(false)

  // Generate atom positions (single unit cell only for thumbnail)
  const atomPositions = useMemo(() => {
    return crystalData.atoms.map((atom) => {
      const cart = fractionalToCartesian(
        { x: atom.x, y: atom.y, z: atom.z },
        crystalData.lattice
      )
      return {
        position: [cart.x, cart.y, cart.z] as [number, number, number],
        element: atom.element,
      }
    })
  }, [crystalData])

  // Calculate center and camera position
  const { center, cameraPos } = useMemo(() => {
    const [va, vb, vc] = getLatticeVectors(crystalData.lattice)
    const center = new THREE.Vector3(
      (va.x + vb.x + vc.x) / 2,
      (va.y + vb.y + vc.y) / 2,
      (va.z + vb.z + vc.z) / 2
    )

    const maxDim = Math.max(
      crystalData.lattice.a,
      crystalData.lattice.b,
      crystalData.lattice.c
    )
    const distance = maxDim * 2.2

    // Position camera at an angle for nice 3D view
    const cameraPos = new THREE.Vector3(
      center.x + distance * 0.7,
      center.y + distance * 0.5,
      center.z + distance * 0.7
    )

    return { center, cameraPos }
  }, [crystalData])

  // Set up camera on mount
  useEffect(() => {
    camera.position.copy(cameraPos)
    camera.lookAt(center)
  }, [camera, cameraPos, center])

  // Capture after first render
  useFrame(() => {
    if (!capturedRef.current) {
      capturedRef.current = true
      // Render the scene
      gl.render(scene, camera)
      // Capture as data URL
      const dataUrl = gl.domElement.toDataURL('image/png')
      onCapture(dataUrl)
    }
  })

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 10]} intensity={1} />
      <directionalLight position={[-10, -10, -10]} intensity={0.4} />

      {/* Unit cell wireframe */}
      <ThumbnailUnitCell lattice={crystalData.lattice} />

      {/* Atoms */}
      {atomPositions.map((atom, idx) => (
        <ThumbnailAtom
          key={idx}
          position={atom.position}
          element={atom.element}
          radiusScale={0.5}
        />
      ))}
    </>
  )
}

export function CrystalThumbnail({ crystalData, structureId }: CrystalThumbnailProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(() => 
    thumbnailCache.get(structureId) ?? null
  )
  const [isCapturing, setIsCapturing] = useState(false)

  // If no crystal data, show placeholder
  if (!crystalData || crystalData.atoms.length === 0) {
    return (
      <div className="h-20 w-full overflow-hidden rounded-t-lg">
        <Placeholder />
      </div>
    )
  }

  // If we have a cached image, show it
  if (imageUrl) {
    return (
      <div className="h-20 w-full overflow-hidden rounded-t-lg">
        <img
          src={imageUrl}
          alt="Crystal structure preview"
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  // Otherwise, render the capture canvas with skeleton
  return (
    <div className="relative h-20 w-full overflow-hidden rounded-t-lg">
      {/* Skeleton shown while capturing */}
      {!isCapturing && <SkeletonShimmer />}
      
      {/* Hidden canvas for capture - only mount once */}
      <div className={`absolute inset-0 ${imageUrl ? 'hidden' : ''}`}>
        <Canvas
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          frameloop="always"
          dpr={[1, 2]}
          onCreated={() => setIsCapturing(true)}
        >
          <color attach="background" args={['#0f172a']} />
          <PerspectiveCamera makeDefault fov={50} near={0.1} far={1000} />
          <CaptureScene
            crystalData={crystalData}
            onCapture={(dataUrl) => {
              thumbnailCache.set(structureId, dataUrl)
              setImageUrl(dataUrl)
            }}
          />
        </Canvas>
      </div>
    </div>
  )
}
