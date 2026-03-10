# @kouhin/redaxios

[![npm](https://img.shields.io/npm/v/@kouhin/redaxios.svg)](https://www.npmjs.com/package/@kouhin/redaxios)
[![CI](https://github.com/kouhin/redaxios/actions/workflows/main.yml/badge.svg)](https://github.com/kouhin/redaxios/actions/workflows/main.yml)
[![license](https://img.shields.io/npm/l/@kouhin/redaxios.svg)](https://github.com/kouhin/redaxios/blob/master/LICENSE)

The [Axios] API, as a tiny Fetch wrapper. Rewritten in TypeScript with full type definitions and axios-compatible error handling.

> This is a fork of [developit/redaxios](https://github.com/developit/redaxios).

## Why this fork?

The original [redaxios](https://github.com/developit/redaxios) by [Jason Miller](https://github.com/developit) is an excellent project that provides the Axios API in a tiny package using the browser's native `fetch()`. However, the original project has not been actively maintained since version 0.5.1, and has several limitations:

- **No TypeScript source** -- written in JavaScript with JSDoc type annotations, resulting in incomplete type definitions.
- **Error handling incompatible with Axios** -- rejected promises returned the response object directly instead of an `Error` instance, making `try/catch` patterns and error inspection unreliable.
- **Outdated toolchain** -- relied on legacy tools (microbundle, karmatic/Jasmine, ESLint + Prettier, npm) that are no longer well-maintained.

This fork addresses all of the above while keeping the original design philosophy: a minimal, drop-in replacement for Axios built on `fetch()`.

## Changes from upstream

- **Full TypeScript rewrite** with exported types: `Options`, `Response`, `RedaxiosError`, `RedaxiosInstance`, etc.
- **Axios-compatible error handling** -- errors are proper `Error` instances with `message`, `status`, `code` (`ERR_BAD_REQUEST` / `ERR_BAD_RESPONSE` / `ERR_NETWORK`), `response`, `config`, and `isAxiosError` flag.
- **`axios.isAxiosError()` helper** for type-safe error checking.
- **Modern toolchain**: [Bun](https://bun.sh) for package management, building, and testing; [Biome](https://biomejs.dev) for linting and formatting.
- **ESM + CJS dual output** (UMD removed as obsolete).

## Install

```bash
npm install @kouhin/redaxios
# or
bun add @kouhin/redaxios
# or
pnpm add @kouhin/redaxios
```

## Usage

```typescript
import axios from '@kouhin/redaxios';

// GET request
const res = await axios.get('/api/users');
console.log(res.data);

// POST request with JSON body
const res = await axios.post('/api/users', {
  name: 'Alice',
});

// Error handling (axios-compatible)
try {
  await axios.get('/api/not-found');
} catch (err) {
  if (axios.isAxiosError(err)) {
    console.error(err.message);        // "Request failed with status code 404"
    console.error(err.status);         // 404
    console.error(err.code);           // "ERR_BAD_REQUEST"
    console.error(err.response?.data); // response body
  }
}

// Create an instance with defaults
const api = axios.create({
  baseURL: 'https://api.example.com',
  headers: { Authorization: 'Bearer token' },
});
await api.get('/me');
```

## API

This library is designed as a drop-in replacement for [Axios]. Refer to the [Axios Documentation](https://github.com/axios/axios#axios-api) for full API details.

### Supported features

- `axios(url, config?)` / `axios(config)`
- `axios.get()`, `.post()`, `.put()`, `.patch()`, `.delete()`, `.head()`, `.options()`
- `axios.create(defaults)`
- `axios.all()` / `axios.spread()`
- `axios.isAxiosError()`
- `axios.CancelToken` (maps to `AbortController`)
- Request/response interceptors via `transformRequest`
- `baseURL`, `params`, `paramsSerializer`, `headers`, `auth`, `validateStatus`
- `responseType` (`text`, `json`, `blob`, `arrayBuffer`, `stream`, `formData`)
- Custom `fetch` implementation via `options.fetch`

## License

[Apache-2.0](./LICENSE) -- originally created by [Jason Miller](https://github.com/developit) at Google.

[Axios]: https://github.com/axios/axios
