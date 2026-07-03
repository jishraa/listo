interface Env {
  ASSETS: { fetch: typeof fetch }
}

// TinyURL's create endpoint has no CORS headers, so the browser can't call
// it directly — this Worker proxies the request server-side. Only our own
// /join/ invite links may be shortened (prevents use as an open proxy).
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/shorten') {
      const target = url.searchParams.get('url') ?? ''
      if (!target.startsWith(`${url.origin}/join/`)) {
        return new Response('invalid target', { status: 400 })
      }
      try {
        const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(target)}`)
        const short = (await res.text()).trim()
        if (!res.ok || !short.startsWith('https://tinyurl.com/')) {
          return new Response('shorten failed', { status: 502 })
        }
        return new Response(short, {
          headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' },
        })
      } catch {
        return new Response('shorten failed', { status: 502 })
      }
    }

    return env.ASSETS.fetch(request)
  },
}
