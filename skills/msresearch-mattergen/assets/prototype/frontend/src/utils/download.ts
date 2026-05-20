import JSZip from 'jszip'

/**
 * Download a single CIF file
 */
export function downloadCif(filename: string, cifContent: string): void {
  const blob = new Blob([cifContent], { type: 'chemical/x-cif' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.cif') ? filename : `${filename}.cif`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Generate a timestamp string for filenames (e.g., "2026-01-15_14-30-45")
 */
function getTimestamp(): string {
  const now = new Date()
  const date = now.toISOString().split('T')[0]
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-')
  return `${date}_${time}`
}

/**
 * Download multiple CIF files as a single zip archive
 */
export async function downloadMultipleCifsAsZip(
  structures: Array<{ formula: string; cifContent: string; index?: number }>
): Promise<void> {
  const zip = new JSZip()

  structures.forEach((s, i) => {
    const suffix = s.index !== undefined ? s.index + 1 : i + 1
    const filename = `${s.formula}_${suffix}.cif`
    zip.file(filename, s.cifContent)
  })

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mattergen_structures_${getTimestamp()}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
