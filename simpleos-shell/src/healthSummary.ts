/**
 * Builds the caregiver-facing health report. This is intentionally pure and
 * takes only the six already-sanitised values: it never sees reminder files,
 * the home directory, the PIN or any raw command output.
 */
export interface HealthSummaryFields {
  internet: string
  audio: string
  microphone: string
  disk: string
  imageVersion: string
  lastUpdateCheck: string
}

export function buildHealthSummary(fields: HealthSummaryFields): string {
  return [
    'SimpleOS health summary',
    `Internet: ${fields.internet}`,
    `Sound: ${fields.audio}`,
    `Microphone: ${fields.microphone}`,
    `Disk: ${fields.disk}`,
    `Image: ${fields.imageVersion}`,
    `Updates: ${fields.lastUpdateCheck}`,
  ].join('\n')
}
