import { useEffect, useRef } from 'react'

export function ResetCountDialog({ busy, error, onCancel, onConfirm }: {
  busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const element = dialog.current!
    element.showModal(); cancel.current?.focus()
    return () => element.close()
  }, [])
  return <dialog ref={dialog} className="admin-reset-dialog" aria-labelledby="reset-count-title" aria-describedby="reset-count-description"
    onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}>
    <form onSubmit={event => { event.preventDefault(); if (!busy) onConfirm() }} aria-busy={busy}>
      <p className="eyebrow">A FRESH COUNT, THE SAME NIGHT</p><h2 id="reset-count-title">Restart tonight’s count?</h2>
      <div id="reset-count-description"><p>All three current-period counters — Generated, Admitted and Waiting — will restart at zero from the saved server time.</p>
        <p>The closing period’s statistics will be permanently archived under History.</p>
        <p>Existing tickets, redeemed statuses and admission history are preserved. Used QR codes remain invalid. Tickets still to arrive remain valid.</p>
        <p>Older valid tickets can still be admitted in the new period, independently of its Generated and Waiting counts.</p></div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <div className="dashboard-controls"><button ref={cancel} type="button" className="admin-secondary" disabled={busy} onClick={onCancel}>CANCEL</button><button type="submit" className="admin-secondary admin-reset-button" disabled={busy}>{busy ? 'SAVING…' : 'CONFIRM RESET'}</button></div>
    </form>
  </dialog>
}
