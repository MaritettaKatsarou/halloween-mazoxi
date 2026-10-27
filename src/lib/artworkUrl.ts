export function artworkUrl(file: string, base = import.meta.env.BASE_URL) {
  // Keep reserved commas literal; encode spaces and Greek filenames once.
  return `${base}${encodeURI(file)}`
}
