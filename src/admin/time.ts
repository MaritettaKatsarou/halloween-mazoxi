export const admissionTime = (value: string) => new Date(value).toLocaleString('el-GR', { timeZone: 'Europe/Athens' })
export const exactAdmissionTime = (value: string) => new Date(value).toLocaleString('el-GR', {
  timeZone: 'Europe/Athens', year: 'numeric', month: 'short', day: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'shortOffset',
})
