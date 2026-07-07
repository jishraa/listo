import { useNavigate } from 'react-router-dom'

// Back that never exits the app: pops in-app history when there is any,
// otherwise lands on the root. Deep links and fresh loads (e.g. opening
// /profile/about directly, or a legal page from the register form) have no
// history entry to pop — navigate(-1) would do nothing or leave the PWA.
export function useSafeBack() {
  const navigate = useNavigate()
  return () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate('/', { replace: true })
  }
}
