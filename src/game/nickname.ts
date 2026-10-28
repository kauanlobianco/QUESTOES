const KEY = 'mdn:nickname'

export function loadNickname(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveNickname(name: string) {
  try {
    localStorage.setItem(KEY, name)
  } catch {
    // Ignora: modo privado.
  }
}
