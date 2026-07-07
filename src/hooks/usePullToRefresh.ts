import { useRef, useState } from 'react'

// Touch pull-to-refresh for a scrollable page container. Attach `scrollRef`
// and spread `handlers` on the scroll element, render <PullIndicator/> with
// `pullY`/`isRefreshing` as its first child. Only engages when the container
// is scrolled to the top and the drag moves downward.
export function usePullToRefresh(onRefresh: () => Promise<unknown>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const scrollTop = scrollRef.current?.scrollTop ?? 0
    if (scrollTop > 0 || isRefreshing) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0) setPullY(Math.min(delta * 0.55, 72))
  }

  const onTouchEnd = async () => {
    if (pullY >= 60) {
      setIsRefreshing(true)
      setPullY(0)
      try { await onRefresh() } finally { setIsRefreshing(false) }
    } else {
      setPullY(0)
    }
  }

  return { scrollRef, pullY, isRefreshing, handlers: { onTouchStart, onTouchMove, onTouchEnd } }
}
