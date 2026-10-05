import { useEffect, useState } from 'react'
import { pb } from '../lib/pb.js'

const users = () => pb.collection('users')

export function useAuth() {
  const [user, setUser] = useState(() => (pb.authStore.isValid ? pb.authStore.record : null))

  useEffect(() => {
    const off = pb.authStore.onChange(() => {
      setUser(pb.authStore.isValid ? pb.authStore.record : null)
    })
    // Renueva el token al abrir. Si el servidor lo rechaza (cuenta borrada, token
    // revocado) se cierra la sesión; si no hay red, se sigue con la sesión guardada.
    if (pb.authStore.isValid) {
      users()
        .authRefresh()
        .catch((err) => {
          if (err.status === 401 || err.status === 403 || err.status === 404) pb.authStore.clear()
        })
    }
    return off
  }, [])

  const login = (email, password) => users().authWithPassword(email, password)

  const logout = () => pb.authStore.clear()

  return { user, login, logout }
}
