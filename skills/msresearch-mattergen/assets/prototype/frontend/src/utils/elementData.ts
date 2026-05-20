/**
 * Element properties for 3D visualization
 * Colors based on CPK coloring scheme
 * Radii are covalent radii in Angstroms
 */

export interface ElementProps {
  color: string
  radius: number
  name: string
}

export const ELEMENT_DATA: Record<string, ElementProps> = {
  // Period 1
  H: { color: '#FFFFFF', radius: 0.31, name: 'Hydrogen' },
  He: { color: '#D9FFFF', radius: 0.28, name: 'Helium' },

  // Period 2
  Li: { color: '#CC80FF', radius: 1.28, name: 'Lithium' },
  Be: { color: '#C2FF00', radius: 0.96, name: 'Beryllium' },
  B: { color: '#FFB5B5', radius: 0.84, name: 'Boron' },
  C: { color: '#909090', radius: 0.76, name: 'Carbon' },
  N: { color: '#3050F8', radius: 0.71, name: 'Nitrogen' },
  O: { color: '#FF0D0D', radius: 0.66, name: 'Oxygen' },
  F: { color: '#90E050', radius: 0.57, name: 'Fluorine' },
  Ne: { color: '#B3E3F5', radius: 0.58, name: 'Neon' },

  // Period 3
  Na: { color: '#AB5CF2', radius: 1.66, name: 'Sodium' },
  Mg: { color: '#8AFF00', radius: 1.41, name: 'Magnesium' },
  Al: { color: '#BFA6A6', radius: 1.21, name: 'Aluminum' },
  Si: { color: '#F0C8A0', radius: 1.11, name: 'Silicon' },
  P: { color: '#FF8000', radius: 1.07, name: 'Phosphorus' },
  S: { color: '#FFFF30', radius: 1.05, name: 'Sulfur' },
  Cl: { color: '#1FF01F', radius: 1.02, name: 'Chlorine' },
  Ar: { color: '#80D1E3', radius: 1.06, name: 'Argon' },

  // Period 4
  K: { color: '#8F40D4', radius: 2.03, name: 'Potassium' },
  Ca: { color: '#3DFF00', radius: 1.76, name: 'Calcium' },
  Sc: { color: '#E6E6E6', radius: 1.7, name: 'Scandium' },
  Ti: { color: '#BFC2C7', radius: 1.6, name: 'Titanium' },
  V: { color: '#A6A6AB', radius: 1.53, name: 'Vanadium' },
  Cr: { color: '#8A99C7', radius: 1.39, name: 'Chromium' },
  Mn: { color: '#9C7AC7', radius: 1.39, name: 'Manganese' },
  Fe: { color: '#E06633', radius: 1.32, name: 'Iron' },
  Co: { color: '#F090A0', radius: 1.26, name: 'Cobalt' },
  Ni: { color: '#50D050', radius: 1.24, name: 'Nickel' },
  Cu: { color: '#C88033', radius: 1.32, name: 'Copper' },
  Zn: { color: '#7D80B0', radius: 1.22, name: 'Zinc' },
  Ga: { color: '#C28F8F', radius: 1.22, name: 'Gallium' },
  Ge: { color: '#668F8F', radius: 1.2, name: 'Germanium' },
  As: { color: '#BD80E3', radius: 1.19, name: 'Arsenic' },
  Se: { color: '#FFA100', radius: 1.2, name: 'Selenium' },
  Br: { color: '#A62929', radius: 1.2, name: 'Bromine' },
  Kr: { color: '#5CB8D1', radius: 1.16, name: 'Krypton' },

  // Period 5
  Rb: { color: '#702EB0', radius: 2.2, name: 'Rubidium' },
  Sr: { color: '#00FF00', radius: 1.95, name: 'Strontium' },
  Y: { color: '#94FFFF', radius: 1.9, name: 'Yttrium' },
  Zr: { color: '#94E0E0', radius: 1.75, name: 'Zirconium' },
  Nb: { color: '#73C2C9', radius: 1.64, name: 'Niobium' },
  Mo: { color: '#54B5B5', radius: 1.54, name: 'Molybdenum' },
  Tc: { color: '#3B9E9E', radius: 1.47, name: 'Technetium' },
  Ru: { color: '#248F8F', radius: 1.46, name: 'Ruthenium' },
  Rh: { color: '#0A7D8C', radius: 1.42, name: 'Rhodium' },
  Pd: { color: '#006985', radius: 1.39, name: 'Palladium' },
  Ag: { color: '#C0C0C0', radius: 1.45, name: 'Silver' },
  Cd: { color: '#FFD98F', radius: 1.44, name: 'Cadmium' },
  In: { color: '#A67573', radius: 1.42, name: 'Indium' },
  Sn: { color: '#668080', radius: 1.39, name: 'Tin' },
  Sb: { color: '#9E63B5', radius: 1.39, name: 'Antimony' },
  Te: { color: '#D47A00', radius: 1.38, name: 'Tellurium' },
  I: { color: '#940094', radius: 1.39, name: 'Iodine' },
  Xe: { color: '#429EB0', radius: 1.4, name: 'Xenon' },

  // Period 6
  Cs: { color: '#57178F', radius: 2.44, name: 'Cesium' },
  Ba: { color: '#00C900', radius: 2.15, name: 'Barium' },
  La: { color: '#70D4FF', radius: 2.07, name: 'Lanthanum' },
  Ce: { color: '#FFFFC7', radius: 2.04, name: 'Cerium' },
  Pr: { color: '#D9FFC7', radius: 2.03, name: 'Praseodymium' },
  Nd: { color: '#C7FFC7', radius: 2.01, name: 'Neodymium' },
  Pm: { color: '#A3FFC7', radius: 1.99, name: 'Promethium' },
  Sm: { color: '#8FFFC7', radius: 1.98, name: 'Samarium' },
  Eu: { color: '#61FFC7', radius: 1.98, name: 'Europium' },
  Gd: { color: '#45FFC7', radius: 1.96, name: 'Gadolinium' },
  Tb: { color: '#30FFC7', radius: 1.94, name: 'Terbium' },
  Dy: { color: '#1FFFC7', radius: 1.92, name: 'Dysprosium' },
  Ho: { color: '#00FF9C', radius: 1.92, name: 'Holmium' },
  Er: { color: '#00E675', radius: 1.89, name: 'Erbium' },
  Tm: { color: '#00D452', radius: 1.9, name: 'Thulium' },
  Yb: { color: '#00BF38', radius: 1.87, name: 'Ytterbium' },
  Lu: { color: '#00AB24', radius: 1.87, name: 'Lutetium' },
  Hf: { color: '#4DC2FF', radius: 1.75, name: 'Hafnium' },
  Ta: { color: '#4DA6FF', radius: 1.7, name: 'Tantalum' },
  W: { color: '#2194D6', radius: 1.62, name: 'Tungsten' },
  Re: { color: '#267DAB', radius: 1.51, name: 'Rhenium' },
  Os: { color: '#266696', radius: 1.44, name: 'Osmium' },
  Ir: { color: '#175487', radius: 1.41, name: 'Iridium' },
  Pt: { color: '#D0D0E0', radius: 1.36, name: 'Platinum' },
  Au: { color: '#FFD123', radius: 1.36, name: 'Gold' },
  Hg: { color: '#B8B8D0', radius: 1.32, name: 'Mercury' },
  Tl: { color: '#A6544D', radius: 1.45, name: 'Thallium' },
  Pb: { color: '#575961', radius: 1.46, name: 'Lead' },
  Bi: { color: '#9E4FB5', radius: 1.48, name: 'Bismuth' },
  Po: { color: '#AB5C00', radius: 1.4, name: 'Polonium' },
  At: { color: '#754F45', radius: 1.5, name: 'Astatine' },
  Rn: { color: '#428296', radius: 1.5, name: 'Radon' },

  // Period 7 (actinides and beyond)
  Fr: { color: '#420066', radius: 2.6, name: 'Francium' },
  Ra: { color: '#007D00', radius: 2.21, name: 'Radium' },
  Ac: { color: '#70ABFA', radius: 2.15, name: 'Actinium' },
  Th: { color: '#00BAFF', radius: 2.06, name: 'Thorium' },
  Pa: { color: '#00A1FF', radius: 2.0, name: 'Protactinium' },
  U: { color: '#008FFF', radius: 1.96, name: 'Uranium' },
  Np: { color: '#0080FF', radius: 1.9, name: 'Neptunium' },
  Pu: { color: '#006BFF', radius: 1.87, name: 'Plutonium' },
  Am: { color: '#545CF2', radius: 1.8, name: 'Americium' },
  Cm: { color: '#785CE3', radius: 1.69, name: 'Curium' },
}

/**
 * Get element properties, with fallback for unknown elements
 */
export function getElementProps(element: string): ElementProps {
  // Normalize element symbol (first letter uppercase, rest lowercase)
  const normalized = element.charAt(0).toUpperCase() + element.slice(1).toLowerCase()

  return (
    ELEMENT_DATA[normalized] || {
      color: '#FF69B4', // Hot pink for unknown
      radius: 1.0,
      name: element,
    }
  )
}
