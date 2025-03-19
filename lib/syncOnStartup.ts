import { startScheduledSync } from "./scheduledSync"

// Add a global variable to track if sync has been started
let syncStarted = false

export function initializeSync() {
  // Only start sync if it hasn't been started yet
  if (!syncStarted) {
    console.log("Iniciando proceso de sincronización...")
    startScheduledSync()
    syncStarted = true
  } else {
    console.log("Sincronización ya iniciada anteriormente, omitiendo...")
  }
}

