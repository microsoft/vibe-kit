/**
 * Periodic Table Element Data for MatterGen Chemical System Picker
 *
 * Each element has:
 * - symbol: Element symbol
 * - name: Full element name
 * - atomicNumber: Atomic number (Z)
 * - row: Row in periodic table (1-7 for main, 8-9 for lanthanides/actinides)
 * - col: Column in periodic table (1-18)
 * - category: Element category for coloring
 */

export type ElementCategory =
  | 'alkali-metal'
  | 'alkaline-earth'
  | 'transition-metal'
  | 'post-transition-metal'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble-gas'
  | 'lanthanide'
  | 'actinide'

export interface Element {
  symbol: string
  name: string
  atomicNumber: number
  row: number
  col: number
  category: ElementCategory
}

// Supported elements by MatterGen (76 elements)
export const SUPPORTED_ELEMENTS = new Set([
  'H', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl',
  'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Ga', 'Ge', 'As', 'Se', 'Br',
  'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd',
  'In', 'Sn', 'Sb', 'Te', 'I',
  'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu',
  'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg',
  'Tl', 'Pb', 'Bi', 'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu',
])

// Unsupported elements (noble gases + Tc + Pm)
export const UNSUPPORTED_ELEMENTS = new Set(['He', 'Ne', 'Ar', 'Kr', 'Xe', 'Tc', 'Pm'])

// Full periodic table data with visual positions
export const PERIODIC_TABLE: Element[] = [
  // Row 1
  { symbol: 'H', name: 'Hydrogen', atomicNumber: 1, row: 1, col: 1, category: 'nonmetal' },
  { symbol: 'He', name: 'Helium', atomicNumber: 2, row: 1, col: 18, category: 'noble-gas' },

  // Row 2
  { symbol: 'Li', name: 'Lithium', atomicNumber: 3, row: 2, col: 1, category: 'alkali-metal' },
  { symbol: 'Be', name: 'Beryllium', atomicNumber: 4, row: 2, col: 2, category: 'alkaline-earth' },
  { symbol: 'B', name: 'Boron', atomicNumber: 5, row: 2, col: 13, category: 'metalloid' },
  { symbol: 'C', name: 'Carbon', atomicNumber: 6, row: 2, col: 14, category: 'nonmetal' },
  { symbol: 'N', name: 'Nitrogen', atomicNumber: 7, row: 2, col: 15, category: 'nonmetal' },
  { symbol: 'O', name: 'Oxygen', atomicNumber: 8, row: 2, col: 16, category: 'nonmetal' },
  { symbol: 'F', name: 'Fluorine', atomicNumber: 9, row: 2, col: 17, category: 'halogen' },
  { symbol: 'Ne', name: 'Neon', atomicNumber: 10, row: 2, col: 18, category: 'noble-gas' },

  // Row 3
  { symbol: 'Na', name: 'Sodium', atomicNumber: 11, row: 3, col: 1, category: 'alkali-metal' },
  { symbol: 'Mg', name: 'Magnesium', atomicNumber: 12, row: 3, col: 2, category: 'alkaline-earth' },
  { symbol: 'Al', name: 'Aluminum', atomicNumber: 13, row: 3, col: 13, category: 'post-transition-metal' },
  { symbol: 'Si', name: 'Silicon', atomicNumber: 14, row: 3, col: 14, category: 'metalloid' },
  { symbol: 'P', name: 'Phosphorus', atomicNumber: 15, row: 3, col: 15, category: 'nonmetal' },
  { symbol: 'S', name: 'Sulfur', atomicNumber: 16, row: 3, col: 16, category: 'nonmetal' },
  { symbol: 'Cl', name: 'Chlorine', atomicNumber: 17, row: 3, col: 17, category: 'halogen' },
  { symbol: 'Ar', name: 'Argon', atomicNumber: 18, row: 3, col: 18, category: 'noble-gas' },

  // Row 4
  { symbol: 'K', name: 'Potassium', atomicNumber: 19, row: 4, col: 1, category: 'alkali-metal' },
  { symbol: 'Ca', name: 'Calcium', atomicNumber: 20, row: 4, col: 2, category: 'alkaline-earth' },
  { symbol: 'Sc', name: 'Scandium', atomicNumber: 21, row: 4, col: 3, category: 'transition-metal' },
  { symbol: 'Ti', name: 'Titanium', atomicNumber: 22, row: 4, col: 4, category: 'transition-metal' },
  { symbol: 'V', name: 'Vanadium', atomicNumber: 23, row: 4, col: 5, category: 'transition-metal' },
  { symbol: 'Cr', name: 'Chromium', atomicNumber: 24, row: 4, col: 6, category: 'transition-metal' },
  { symbol: 'Mn', name: 'Manganese', atomicNumber: 25, row: 4, col: 7, category: 'transition-metal' },
  { symbol: 'Fe', name: 'Iron', atomicNumber: 26, row: 4, col: 8, category: 'transition-metal' },
  { symbol: 'Co', name: 'Cobalt', atomicNumber: 27, row: 4, col: 9, category: 'transition-metal' },
  { symbol: 'Ni', name: 'Nickel', atomicNumber: 28, row: 4, col: 10, category: 'transition-metal' },
  { symbol: 'Cu', name: 'Copper', atomicNumber: 29, row: 4, col: 11, category: 'transition-metal' },
  { symbol: 'Zn', name: 'Zinc', atomicNumber: 30, row: 4, col: 12, category: 'transition-metal' },
  { symbol: 'Ga', name: 'Gallium', atomicNumber: 31, row: 4, col: 13, category: 'post-transition-metal' },
  { symbol: 'Ge', name: 'Germanium', atomicNumber: 32, row: 4, col: 14, category: 'metalloid' },
  { symbol: 'As', name: 'Arsenic', atomicNumber: 33, row: 4, col: 15, category: 'metalloid' },
  { symbol: 'Se', name: 'Selenium', atomicNumber: 34, row: 4, col: 16, category: 'nonmetal' },
  { symbol: 'Br', name: 'Bromine', atomicNumber: 35, row: 4, col: 17, category: 'halogen' },
  { symbol: 'Kr', name: 'Krypton', atomicNumber: 36, row: 4, col: 18, category: 'noble-gas' },

  // Row 5
  { symbol: 'Rb', name: 'Rubidium', atomicNumber: 37, row: 5, col: 1, category: 'alkali-metal' },
  { symbol: 'Sr', name: 'Strontium', atomicNumber: 38, row: 5, col: 2, category: 'alkaline-earth' },
  { symbol: 'Y', name: 'Yttrium', atomicNumber: 39, row: 5, col: 3, category: 'transition-metal' },
  { symbol: 'Zr', name: 'Zirconium', atomicNumber: 40, row: 5, col: 4, category: 'transition-metal' },
  { symbol: 'Nb', name: 'Niobium', atomicNumber: 41, row: 5, col: 5, category: 'transition-metal' },
  { symbol: 'Mo', name: 'Molybdenum', atomicNumber: 42, row: 5, col: 6, category: 'transition-metal' },
  { symbol: 'Tc', name: 'Technetium', atomicNumber: 43, row: 5, col: 7, category: 'transition-metal' },
  { symbol: 'Ru', name: 'Ruthenium', atomicNumber: 44, row: 5, col: 8, category: 'transition-metal' },
  { symbol: 'Rh', name: 'Rhodium', atomicNumber: 45, row: 5, col: 9, category: 'transition-metal' },
  { symbol: 'Pd', name: 'Palladium', atomicNumber: 46, row: 5, col: 10, category: 'transition-metal' },
  { symbol: 'Ag', name: 'Silver', atomicNumber: 47, row: 5, col: 11, category: 'transition-metal' },
  { symbol: 'Cd', name: 'Cadmium', atomicNumber: 48, row: 5, col: 12, category: 'transition-metal' },
  { symbol: 'In', name: 'Indium', atomicNumber: 49, row: 5, col: 13, category: 'post-transition-metal' },
  { symbol: 'Sn', name: 'Tin', atomicNumber: 50, row: 5, col: 14, category: 'post-transition-metal' },
  { symbol: 'Sb', name: 'Antimony', atomicNumber: 51, row: 5, col: 15, category: 'metalloid' },
  { symbol: 'Te', name: 'Tellurium', atomicNumber: 52, row: 5, col: 16, category: 'metalloid' },
  { symbol: 'I', name: 'Iodine', atomicNumber: 53, row: 5, col: 17, category: 'halogen' },
  { symbol: 'Xe', name: 'Xenon', atomicNumber: 54, row: 5, col: 18, category: 'noble-gas' },

  // Row 6
  { symbol: 'Cs', name: 'Cesium', atomicNumber: 55, row: 6, col: 1, category: 'alkali-metal' },
  { symbol: 'Ba', name: 'Barium', atomicNumber: 56, row: 6, col: 2, category: 'alkaline-earth' },
  // La-Lu are in row 8 (lanthanides)
  { symbol: 'Hf', name: 'Hafnium', atomicNumber: 72, row: 6, col: 4, category: 'transition-metal' },
  { symbol: 'Ta', name: 'Tantalum', atomicNumber: 73, row: 6, col: 5, category: 'transition-metal' },
  { symbol: 'W', name: 'Tungsten', atomicNumber: 74, row: 6, col: 6, category: 'transition-metal' },
  { symbol: 'Re', name: 'Rhenium', atomicNumber: 75, row: 6, col: 7, category: 'transition-metal' },
  { symbol: 'Os', name: 'Osmium', atomicNumber: 76, row: 6, col: 8, category: 'transition-metal' },
  { symbol: 'Ir', name: 'Iridium', atomicNumber: 77, row: 6, col: 9, category: 'transition-metal' },
  { symbol: 'Pt', name: 'Platinum', atomicNumber: 78, row: 6, col: 10, category: 'transition-metal' },
  { symbol: 'Au', name: 'Gold', atomicNumber: 79, row: 6, col: 11, category: 'transition-metal' },
  { symbol: 'Hg', name: 'Mercury', atomicNumber: 80, row: 6, col: 12, category: 'transition-metal' },
  { symbol: 'Tl', name: 'Thallium', atomicNumber: 81, row: 6, col: 13, category: 'post-transition-metal' },
  { symbol: 'Pb', name: 'Lead', atomicNumber: 82, row: 6, col: 14, category: 'post-transition-metal' },
  { symbol: 'Bi', name: 'Bismuth', atomicNumber: 83, row: 6, col: 15, category: 'post-transition-metal' },

  // Row 7 (only showing supported actinides)
  // Ac-Pu are in row 9 (actinides)

  // Row 8: Lanthanides (displayed below main table)
  { symbol: 'La', name: 'Lanthanum', atomicNumber: 57, row: 8, col: 3, category: 'lanthanide' },
  { symbol: 'Ce', name: 'Cerium', atomicNumber: 58, row: 8, col: 4, category: 'lanthanide' },
  { symbol: 'Pr', name: 'Praseodymium', atomicNumber: 59, row: 8, col: 5, category: 'lanthanide' },
  { symbol: 'Nd', name: 'Neodymium', atomicNumber: 60, row: 8, col: 6, category: 'lanthanide' },
  { symbol: 'Pm', name: 'Promethium', atomicNumber: 61, row: 8, col: 7, category: 'lanthanide' },
  { symbol: 'Sm', name: 'Samarium', atomicNumber: 62, row: 8, col: 8, category: 'lanthanide' },
  { symbol: 'Eu', name: 'Europium', atomicNumber: 63, row: 8, col: 9, category: 'lanthanide' },
  { symbol: 'Gd', name: 'Gadolinium', atomicNumber: 64, row: 8, col: 10, category: 'lanthanide' },
  { symbol: 'Tb', name: 'Terbium', atomicNumber: 65, row: 8, col: 11, category: 'lanthanide' },
  { symbol: 'Dy', name: 'Dysprosium', atomicNumber: 66, row: 8, col: 12, category: 'lanthanide' },
  { symbol: 'Ho', name: 'Holmium', atomicNumber: 67, row: 8, col: 13, category: 'lanthanide' },
  { symbol: 'Er', name: 'Erbium', atomicNumber: 68, row: 8, col: 14, category: 'lanthanide' },
  { symbol: 'Tm', name: 'Thulium', atomicNumber: 69, row: 8, col: 15, category: 'lanthanide' },
  { symbol: 'Yb', name: 'Ytterbium', atomicNumber: 70, row: 8, col: 16, category: 'lanthanide' },
  { symbol: 'Lu', name: 'Lutetium', atomicNumber: 71, row: 8, col: 17, category: 'lanthanide' },

  // Row 9: Actinides (only showing supported ones)
  { symbol: 'Ac', name: 'Actinium', atomicNumber: 89, row: 9, col: 3, category: 'actinide' },
  { symbol: 'Th', name: 'Thorium', atomicNumber: 90, row: 9, col: 4, category: 'actinide' },
  { symbol: 'Pa', name: 'Protactinium', atomicNumber: 91, row: 9, col: 5, category: 'actinide' },
  { symbol: 'U', name: 'Uranium', atomicNumber: 92, row: 9, col: 6, category: 'actinide' },
  { symbol: 'Np', name: 'Neptunium', atomicNumber: 93, row: 9, col: 7, category: 'actinide' },
  { symbol: 'Pu', name: 'Plutonium', atomicNumber: 94, row: 9, col: 8, category: 'actinide' },
]

// Get category color classes for Tailwind
export function getCategoryColor(category: ElementCategory, isSelected: boolean, isSupported: boolean): string {
  if (!isSupported) {
    return 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
  }

  const baseColors: Record<ElementCategory, string> = {
    'alkali-metal': isSelected ? 'bg-red-500 text-white' : 'bg-red-500/20 text-red-300 hover:bg-red-500/40',
    'alkaline-earth': isSelected ? 'bg-orange-500 text-white' : 'bg-orange-500/20 text-orange-300 hover:bg-orange-500/40',
    'transition-metal': isSelected ? 'bg-amber-500 text-white' : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/40',
    'post-transition-metal': isSelected ? 'bg-teal-500 text-white' : 'bg-teal-500/20 text-teal-300 hover:bg-teal-500/40',
    'metalloid': isSelected ? 'bg-emerald-500 text-white' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40',
    'nonmetal': isSelected ? 'bg-sky-500 text-white' : 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/40',
    'halogen': isSelected ? 'bg-violet-500 text-white' : 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/40',
    'noble-gas': isSelected ? 'bg-pink-500 text-white' : 'bg-pink-500/20 text-pink-300 hover:bg-pink-500/40',
    'lanthanide': isSelected ? 'bg-fuchsia-500 text-white' : 'bg-fuchsia-500/20 text-fuchsia-300 hover:bg-fuchsia-500/40',
    'actinide': isSelected ? 'bg-rose-500 text-white' : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/40',
  }

  return baseColors[category]
}

// Convert selected elements to chemical_system format (e.g., "Li-O")
export function elementsToChemicalSystem(elements: string[]): string {
  return elements.sort().join('-')
}

// Parse chemical_system back to element array
export function chemicalSystemToElements(chemicalSystem: string): string[] {
  if (!chemicalSystem) return []
  return chemicalSystem.split('-').filter(Boolean)
}
