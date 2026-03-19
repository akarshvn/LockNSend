import useAuthStore from '../store/authStore'

function generateNonce() {
  return Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function signRequest(sessionId, method, path, body) {
  if (!window.electronAPI) return {}

  const timestamp = Date.now().toString()
  const nonce = generateNonce()
  const endpoint = `${method}:${path}`
  const bodyStr = typeof body === 'string' ? body : (body ? JSON.stringify(body) : '')
  const payload = `${endpoint}|${bodyStr}|${timestamp}|${nonce}`

  const result = await window.electronAPI.sign({ sessionId, payload })
  if (!result.ok) return {}

  return {
    'x-timestamp': timestamp,
    'x-nonce': nonce,
    'x-signature': result.signature,
  }
}

export function useApi() {
  const { token, sessionId, serverPort } = useAuthStore()

  const baseUrl = serverPort ? `http://127.0.0.1:${serverPort}` : ''

  async function request(method, path, { body, isMutating = false, isFormData = false } = {}) {
    const headers = {
      Authorization: token ? `Bearer ${token}` : undefined,
    }

    if (!isFormData) headers['Content-Type'] = 'application/json'

    if (isMutating && sessionId) {
      const sigHeaders = await signRequest(sessionId, method, path, isFormData ? '' : body)
      Object.assign(headers, sigHeaders)
    }

    const options = {
      method,
      headers: Object.fromEntries(Object.entries(headers).filter(([, v]) => v !== undefined)),
    }

    if (body !== undefined && !isFormData) {
      options.body = JSON.stringify(body)
    } else if (isFormData) {
      options.body = body
      delete options.headers['Content-Type']
    }

    const res = await fetch(`${baseUrl}${path}`, options)

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`
      try { const j = await res.json(); errMsg = j.error || errMsg } catch {}
      throw new Error(errMsg)
    }

    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) return res.json()
    return res
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body, opts = {}) => request('POST', path, { body, isMutating: opts.mutating ?? false }),
    postMutating: (path, body) => request('POST', path, { body, isMutating: true }),
    postForm: (path, formData) => request('POST', path, { body: formData, isMutating: true, isFormData: true }),
    del: (path) => request('DELETE', path, { isMutating: true }),
  }
}
