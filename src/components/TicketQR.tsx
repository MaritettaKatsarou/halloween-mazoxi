import { QRCodeSVG } from 'qrcode.react'

export function TicketQR({ credential }: { credential: string }) {
  return <QRCodeSVG value={credential} level="M" marginSize={4} size={512}
    bgColor="#ffffff" fgColor="#000000" title="Κωδικός εισόδου" />
}
