export {}

declare global {
  interface Window {
    electronEnv?: {
      isElectron: boolean
    }
  }
}
