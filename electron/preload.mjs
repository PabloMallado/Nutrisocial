import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronEnv', {
  isElectron: true,
})
