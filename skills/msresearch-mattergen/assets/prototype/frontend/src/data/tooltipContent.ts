/**
 * Centralized tooltip content for consistent explanations across the UI.
 */

export const tooltipContent = {
  // Generation parameters
  diffusionGuidanceFactor:
    'Controls how strongly the model follows the property constraints. Higher values (e.g., 2.0) produce structures that more closely match the requested properties, but may reduce diversity.',

  targetProperties:
    'Specify the desired material properties for generation. MatterGen will create crystal structures optimized to match these target values using specialized checkpoints.',

  // Property names
  bandGap:
    'The energy difference between the valence and conduction bands. Materials with band gaps between 0.5-3.0 eV are typically semiconductors useful for electronics and solar cells.',

  bulkModulus:
    'A measure of a material\'s resistance to uniform compression. Higher values indicate harder, less compressible materials. Measured in GPa (gigapascals).',

  chemicalSystem:
    'Specifies which chemical elements should be present in the generated structure. Use element symbols separated by dashes (e.g., "Li-Fe-O" for lithium iron oxide).',

  energyAboveHull:
    'A measure of thermodynamic stability. Values close to 0 eV/atom indicate stable structures. Higher values suggest the material may decompose into more stable phases.',

  hhiScore:
    'Herfindahl-Hirschman Index for elemental abundance. Lower scores indicate materials made from more abundant (cheaper, more sustainable) elements.',

  magneticDensity:
    'The magnetic moment per unit volume. Higher values indicate stronger magnetic properties, useful for magnetic storage or motor applications.',

  spaceGroup:
    'The crystallographic space group number (1-230) that defines the symmetry of the crystal structure. Different space groups have different physical properties.',

  // Evaluation metrics
  isStable:
    'Indicates whether the structure is thermodynamically stable (energy above hull close to 0) and likely to exist under normal conditions.',

  isNovel:
    'Indicates whether this structure appears in known materials databases. Novel structures are potentially new discoveries.',

  isUnique:
    'Indicates whether this structure is distinct from others in the current batch (not a duplicate).',

  energyPerAtom:
    'The total energy of the structure divided by the number of atoms. Lower values generally indicate more stable configurations.',

  totalEnergy:
    'The absolute total energy of the crystal structure in electron volts (eV). Used for comparing relative stability.',
} as const

export type TooltipKey = keyof typeof tooltipContent
