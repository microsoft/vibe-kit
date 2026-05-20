/**
 * CIF (Crystallographic Information File) parser
 * Extracts lattice parameters and atom positions from CIF format
 */

export interface LatticeParams {
  a: number
  b: number
  c: number
  alpha: number // degrees
  beta: number
  gamma: number
}

export interface Atom {
  element: string
  label: string
  x: number // fractional coordinates
  y: number
  z: number
  occupancy: number
}

export interface CrystalData {
  formula: string
  lattice: LatticeParams
  atoms: Atom[]
}

/**
 * Parse a CIF file content into structured crystal data
 */
export function parseCIF(content: string): CrystalData {
  const lines = content.split('\n').map((line) => line.trim())

  // Extract lattice parameters
  const lattice: LatticeParams = {
    a: extractFloat(lines, '_cell_length_a') ?? 1,
    b: extractFloat(lines, '_cell_length_b') ?? 1,
    c: extractFloat(lines, '_cell_length_c') ?? 1,
    alpha: extractFloat(lines, '_cell_angle_alpha') ?? 90,
    beta: extractFloat(lines, '_cell_angle_beta') ?? 90,
    gamma: extractFloat(lines, '_cell_angle_gamma') ?? 90,
  }

  // Extract formula
  const formula =
    extractString(lines, '_chemical_formula_structural') ??
    extractString(lines, '_chemical_formula_sum') ??
    'Unknown'

  // Extract atoms from the loop section
  const atoms = extractAtoms(lines)

  return { formula, lattice, atoms }
}

/**
 * Extract a float value for a given CIF key
 */
function extractFloat(lines: string[], key: string): number | null {
  for (const line of lines) {
    if (line.startsWith(key)) {
      const parts = line.split(/\s+/)
      if (parts.length >= 2) {
        // Handle values with uncertainty like "3.33566965" or "3.335(5)"
        const value = parts[1].replace(/\([^)]*\)/g, '')
        const num = parseFloat(value)
        if (!isNaN(num)) return num
      }
    }
  }
  return null
}

/**
 * Extract a string value for a given CIF key
 */
function extractString(lines: string[], key: string): string | null {
  for (const line of lines) {
    if (line.startsWith(key)) {
      const parts = line.split(/\s+/)
      if (parts.length >= 2) {
        // Remove quotes if present
        return parts.slice(1).join(' ').replace(/^['"]|['"]$/g, '')
      }
    }
  }
  return null
}

/**
 * Extract atom site data from the loop_ section
 */
function extractAtoms(lines: string[]): Atom[] {
  const atoms: Atom[] = []

  // Find the atom_site loop
  let inAtomLoop = false
  let loopHeaders: string[] = []
  let headersDone = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Start of a loop section
    if (line === 'loop_') {
      // Check if next lines contain atom_site headers
      const nextLine = lines[i + 1] || ''
      if (nextLine.includes('_atom_site')) {
        inAtomLoop = true
        loopHeaders = []
        headersDone = false
        continue
      }
    }

    if (inAtomLoop) {
      // Collect headers
      if (line.startsWith('_atom_site')) {
        loopHeaders.push(line)
        continue
      }

      // Headers are done, now we're reading data
      if (loopHeaders.length > 0 && !line.startsWith('_')) {
        headersDone = true
      }

      // Empty line or new section ends the loop
      if (headersDone && (line === '' || line.startsWith('_') || line === 'loop_')) {
        inAtomLoop = false
        continue
      }

      // Parse atom data line
      if (headersDone && line.length > 0) {
        const atom = parseAtomLine(line, loopHeaders)
        if (atom) atoms.push(atom)
      }
    }
  }

  return atoms
}

/**
 * Parse a single atom data line based on the loop headers
 */
function parseAtomLine(line: string, headers: string[]): Atom | null {
  const parts = line.split(/\s+/)
  if (parts.length < headers.length) return null

  const getValue = (key: string): string | null => {
    const idx = headers.indexOf(key)
    return idx >= 0 && idx < parts.length ? parts[idx] : null
  }

  const element = getValue('_atom_site_type_symbol')
  const label = getValue('_atom_site_label') || element
  const xStr = getValue('_atom_site_fract_x')
  const yStr = getValue('_atom_site_fract_y')
  const zStr = getValue('_atom_site_fract_z')
  const occStr = getValue('_atom_site_occupancy')

  if (!element || !xStr || !yStr || !zStr) return null

  // Parse coordinates, removing uncertainty values in parentheses
  const x = parseFloat(xStr.replace(/\([^)]*\)/g, ''))
  const y = parseFloat(yStr.replace(/\([^)]*\)/g, ''))
  const z = parseFloat(zStr.replace(/\([^)]*\)/g, ''))
  const occupancy = occStr ? parseFloat(occStr.replace(/\([^)]*\)/g, '')) : 1

  if (isNaN(x) || isNaN(y) || isNaN(z)) return null

  return {
    element: element || 'X',
    label: label || element || 'X',
    x,
    y,
    z,
    occupancy,
  }
}

/**
 * Convert fractional coordinates to Cartesian coordinates
 * based on lattice parameters
 */
export function fractionalToCartesian(
  frac: { x: number; y: number; z: number },
  lattice: LatticeParams
): { x: number; y: number; z: number } {
  const { a, b, c, alpha, beta, gamma } = lattice

  // Convert angles to radians
  const alphaRad = (alpha * Math.PI) / 180
  const betaRad = (beta * Math.PI) / 180
  const gammaRad = (gamma * Math.PI) / 180

  // Calculate transformation matrix components
  const cosAlpha = Math.cos(alphaRad)
  const cosBeta = Math.cos(betaRad)
  const cosGamma = Math.cos(gammaRad)
  const sinGamma = Math.sin(gammaRad)

  // Volume factor
  const v = Math.sqrt(
    1 -
      cosAlpha * cosAlpha -
      cosBeta * cosBeta -
      cosGamma * cosGamma +
      2 * cosAlpha * cosBeta * cosGamma
  )

  // Transformation matrix (fractional to Cartesian)
  // Using the standard crystallographic convention
  const ax = a
  const bx = b * cosGamma
  const by = b * sinGamma
  const cx = c * cosBeta
  const cy = c * (cosAlpha - cosBeta * cosGamma) / sinGamma
  const cz = (c * v) / sinGamma

  // Apply transformation
  const x = frac.x * ax + frac.y * bx + frac.z * cx
  const y = frac.y * by + frac.z * cy
  const z = frac.z * cz

  return { x, y, z }
}

/**
 * Get the lattice vectors in Cartesian coordinates
 */
export function getLatticeVectors(
  lattice: LatticeParams
): [{ x: number; y: number; z: number }, { x: number; y: number; z: number }, { x: number; y: number; z: number }] {
  const va = fractionalToCartesian({ x: 1, y: 0, z: 0 }, lattice)
  const vb = fractionalToCartesian({ x: 0, y: 1, z: 0 }, lattice)
  const vc = fractionalToCartesian({ x: 0, y: 0, z: 1 }, lattice)
  return [va, vb, vc]
}
