export function createScanLatch(onDetected: (value: string) => void) {
  let detected = false
  return (value: string) => {
    if (detected || !value) return false
    detected = true
    onDetected(value)
    return true
  }
}
