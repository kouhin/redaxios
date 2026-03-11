/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from 'bun:test';
import axios from '../src/index';

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
	server = Bun.serve({
		port: 0,
		async fetch(req) {
			const url = new URL(req.url);
			const path = url.pathname;

			const delayMatch = path.match(/^\/delay\/(\d+)$/);
			if (delayMatch) {
				const ms = Number.parseInt(delayMatch[1], 10);
				await new Promise((resolve) => setTimeout(resolve, ms));
				return new Response(JSON.stringify({ delayed: ms }), {
					headers: { 'content-type': 'application/json' }
				});
			}

			const file = Bun.file(`test/fixtures${path}`);
			if (await file.exists()) return new Response(file);
			return new Response('Not Found', { status: 404 });
		}
	});
	baseUrl = `http://localhost:${server.port}`;
});

afterAll(() => {
	server.stop();
});

describe('redaxios', () => {
	describe('basic functionality', () => {
		it('should return text and a 200 status for a simple GET request', async () => {
			const req = axios(`${baseUrl}/example.txt`);
			expect(req).toBeInstanceOf(Promise);
			const res = await req;
			expect(res).toBeInstanceOf(Object);
			expect(res.status).toEqual(200);
			expect(res.data).toEqual('some example content');
		});

		it('should return a rejected promise for 404 responses', async () => {
			const req = axios(`${baseUrl}/foo.txt`);
			expect(req).toBeInstanceOf(Promise);
			try {
				await req;
				throw new Error('should have rejected');
			} catch (err: any) {
				expect(err).toBeInstanceOf(Error);
				expect(err.message).toEqual('Request failed with status code 404');
				expect(err.status).toEqual(404);
				expect(err.isAxiosError).toBe(true);
				expect(err.code).toEqual('ERR_BAD_REQUEST');
				expect(err.config).toBeDefined();
				expect(err.response).toBeDefined();
				expect(err.response.status).toEqual(404);
				expect(axios.isAxiosError(err)).toBe(true);
			}
		});
	});

	describe('options.responseType', () => {
		it('should parse responses as JSON by default', async () => {
			const res = await axios.get(`${baseUrl}/example.json.txt`);
			expect(res.data).toEqual({ hello: 'world' });
		});

		it('should fall back to text for non-JSON by default', async () => {
			const res = await axios.get(`${baseUrl}/example.txt`);
			expect(res.data).toEqual('some example content');
		});

		it('should force JSON for responseType:json', async () => {
			const res = await axios.get(`${baseUrl}/example.json.txt`, {
				responseType: 'json'
			});
			expect(res.data).toEqual({ hello: 'world' });
		});

		it('should fall back to undefined for failed JSON parse', async () => {
			const res = await axios.get(`${baseUrl}/example.txt`, {
				responseType: 'json'
			});
			expect(res.data).toEqual(undefined);
		});

		it('should still parse JSON when responseType:text', async () => {
			const res = await axios.get(`${baseUrl}/example.json.txt`, {
				responseType: 'text'
			});
			expect(res.data).toEqual({ hello: 'world' });
		});
	});

	describe('options.baseURL', () => {
		it('should resolve URLs relative to baseURL if provided', async () => {
			const originalFetch = globalThis.fetch;
			try {
				const fetchMock = jest.fn(() =>
					Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') } as any)
				);
				globalThis.fetch = fetchMock as any;
				const req = axios.get('/bar', {
					baseURL: 'http://foo'
				});
				expect(fetchMock).toHaveBeenCalledTimes(1);
				expect(fetchMock.mock.calls[0][0]).toEqual('http://foo/bar');
				expect(fetchMock.mock.calls[0][1]).toEqual(
					expect.objectContaining({
						method: 'GET',
						headers: {},
						body: undefined
					})
				);
				const res = await req;
				expect(res.status).toEqual(200);
			} finally {
				globalThis.fetch = originalFetch;
			}
		});

		it('should resolve baseURL for relative URIs', async () => {
			const originalFetch = globalThis.fetch;
			try {
				const fetchMock = jest.fn(() =>
					Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') } as any)
				);
				globalThis.fetch = fetchMock as any;
				const req = axios.get('/bar', {
					baseURL: '/foo'
				});
				expect(fetchMock).toHaveBeenCalledTimes(1);
				expect(fetchMock.mock.calls[0][0]).toEqual('/foo/bar');
				expect(fetchMock.mock.calls[0][1]).toEqual(
					expect.objectContaining({
						method: 'GET',
						headers: {},
						body: undefined
					})
				);
				const res = await req;
				expect(res.status).toEqual(200);
			} finally {
				globalThis.fetch = originalFetch;
			}
		});
	});

	describe('options.headers', () => {
		it('should merge headers case-insensitively', async () => {
			const originalFetch = globalThis.fetch;
			try {
				const fetchMock = jest.fn(() =>
					Promise.resolve({
						ok: true,
						status: 200,
						text: () => Promise.resolve('yep')
					} as any)
				);
				globalThis.fetch = fetchMock as any;

				await axios('/', { headers: { 'x-foo': '2' } });
				expect(fetchMock.mock.calls[0][1].headers).toEqual({
					'x-foo': '2'
				});

				fetchMock.mockClear();

				await axios('/', { headers: { 'x-foo': '2', 'X-Foo': '4' } });
				expect(fetchMock.mock.calls[0][1].headers).toEqual({
					'x-foo': '4'
				});

				fetchMock.mockClear();

				const request = axios.create({
					headers: {
						'Base-Upper': 'base',
						'base-lower': 'base'
					}
				});
				await request('/');
				expect(fetchMock.mock.calls[0][1].headers).toEqual({
					'base-upper': 'base',
					'base-lower': 'base'
				});

				fetchMock.mockClear();

				await request('/', {
					headers: {
						'base-upper': 'replaced',
						'BASE-LOWER': 'replaced'
					}
				});
				expect(fetchMock.mock.calls[0][1].headers).toEqual({
					'base-upper': 'replaced',
					'base-lower': 'replaced'
				});
			} finally {
				globalThis.fetch = originalFetch;
			}
		});
	});

	describe('options.body (request bodies)', () => {
		let originalFetch: typeof globalThis.fetch;
		let fetchMock: ReturnType<typeof jest.fn>;
		beforeEach(() => {
			originalFetch = globalThis.fetch;
			fetchMock = jest.fn(() =>
				Promise.resolve({
					ok: true,
					status: 200,
					text: () => Promise.resolve('yep')
				} as any)
			);
			globalThis.fetch = fetchMock as any;
		});
		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		it('should issue POST requests (with JSON body)', async () => {
			const res = await axios.post('/foo', {
				hello: 'world'
			});
			expect(fetchMock).toHaveBeenCalledWith(
				'/foo',
				expect.objectContaining({
					method: 'POST',
					headers: {
						'content-type': 'application/json'
					},
					body: '{"hello":"world"}'
				})
			);
			expect(res.status).toEqual(200);
			expect(res.data).toEqual('yep');
		});

		it('should issue PATCH requests (with JSON body)', async () => {
			const res = await axios.patch('/foo', {
				hello: 'world'
			});
			expect(fetchMock).toHaveBeenCalledWith(
				'/foo',
				expect.objectContaining({
					method: 'PATCH',
					headers: {
						'content-type': 'application/json'
					},
					body: '{"hello":"world"}'
				})
			);
			expect(res.status).toEqual(200);
			expect(res.data).toEqual('yep');
		});

		describe('FormData support', () => {
			it('should not send JSON content-type when data contains FormData', async () => {
				const formData = new FormData();
				await axios.post('/foo', formData);
				expect(fetchMock).toHaveBeenCalledWith(
					'/foo',
					expect.objectContaining({
						body: formData,
						headers: {}
					})
				);
			});

			it('should preserve global content-type option when using FormData', async () => {
				const data = new FormData();
				data.append('hello', 'world');
				const res = await axios.post('/foo', data, { headers: { 'content-type': 'multipart/form-data' } });
				expect(fetchMock).toHaveBeenCalledTimes(1);
				expect(fetchMock).toHaveBeenCalledWith(
					'/foo',
					expect.objectContaining({
						method: 'POST',
						headers: {
							'content-type': 'multipart/form-data'
						},
						body: data
					})
				);
				expect(res.status).toEqual(200);
				expect(res.data).toEqual('yep');
			});
		});
	});

	describe('options.fetch', () => {
		it('should accept a custom fetch implementation', async () => {
			const req = axios.get(`${baseUrl}/example.json.txt`, { fetch });
			expect(req).toBeInstanceOf(Promise);
			const res = await req;
			expect(res).toBeInstanceOf(Object);
			expect(res.status).toEqual(200);
			expect(res.data).toEqual({ hello: 'world' });
		});
	});

	describe('options.params & options.paramsSerializer', () => {
		let originalFetch: typeof globalThis.fetch;
		let fetchMock: ReturnType<typeof jest.fn>;
		beforeEach(() => {
			originalFetch = globalThis.fetch;
			fetchMock = jest.fn(() => Promise.resolve(new Response()));
			globalThis.fetch = fetchMock as any;
		});

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		it('should not serialize missing params', () => {
			axios.get('/foo');
			expect(fetchMock.mock.calls[0][0]).toEqual('/foo');
		});

		it('should serialize numeric and boolean params', () => {
			const params = { a: 1, b: true };
			axios.get('/foo', { params });
			expect(fetchMock.mock.calls[0][0]).toEqual('/foo?a=1&b=true');
		});

		it('should merge params into existing url querystring', () => {
			const params = { a: 1, b: true };
			axios.get('/foo?c=42', { params });
			expect(fetchMock.mock.calls[0][0]).toEqual('/foo?c=42&a=1&b=true');
		});

		it('should accept a URLSearchParams instance', () => {
			const params = new URLSearchParams({ d: 'test' });
			axios.get('/foo', { params });
			expect(fetchMock.mock.calls[0][0]).toEqual('/foo?d=test');
		});

		it('should accept a custom paramsSerializer function', () => {
			const params = { a: 1, b: true };
			const paramsSerializer = () => 'e=iamthelaw';
			axios.get('/foo', { params, paramsSerializer });
			expect(fetchMock.mock.calls[0][0]).toEqual('/foo?e=iamthelaw');
		});
	});

	describe('error handling', () => {
		it('should produce ERR_BAD_REQUEST for 4xx errors', async () => {
			const originalFetch = globalThis.fetch;
			try {
				globalThis.fetch = jest.fn(() =>
					Promise.resolve({
						ok: false,
						status: 400,
						statusText: 'Bad Request',
						text: () => Promise.resolve('bad')
					} as any)
				) as any;
				await expect(axios.get('/foo')).rejects.toThrow('Request failed with status code 400');
				try {
					await axios.get('/bar');
				} catch (err: any) {
					expect(err.code).toEqual('ERR_BAD_REQUEST');
					expect(err.status).toEqual(400);
				}
			} finally {
				globalThis.fetch = originalFetch;
			}
		});

		it('should produce ERR_BAD_RESPONSE for 5xx errors', async () => {
			const originalFetch = globalThis.fetch;
			try {
				globalThis.fetch = jest.fn(() =>
					Promise.resolve({
						ok: false,
						status: 500,
						statusText: 'Internal Server Error',
						text: () => Promise.resolve('error')
					} as any)
				) as any;
				try {
					await axios.get('/foo');
					throw new Error('should have rejected');
				} catch (err: any) {
					expect(err).toBeInstanceOf(Error);
					expect(err.message).toEqual('Request failed with status code 500');
					expect(err.code).toEqual('ERR_BAD_RESPONSE');
					expect(err.status).toEqual(500);
					expect(err.isAxiosError).toBe(true);
				}
			} finally {
				globalThis.fetch = originalFetch;
			}
		});

		it('should produce ERR_NETWORK for network failures', async () => {
			const originalFetch = globalThis.fetch;
			try {
				globalThis.fetch = jest.fn(() => Promise.reject(new TypeError('Failed to fetch'))) as any;
				try {
					await axios.get('/foo');
					throw new Error('should have rejected');
				} catch (err: any) {
					expect(err).toBeInstanceOf(Error);
					expect(err.message).toEqual('Failed to fetch');
					expect(err.code).toEqual('ERR_NETWORK');
					expect(err.status).toEqual(0);
					expect(err.isAxiosError).toBe(true);
				}
			} finally {
				globalThis.fetch = originalFetch;
			}
		});

		it('should include response data in error.response', async () => {
			const originalFetch = globalThis.fetch;
			try {
				globalThis.fetch = jest.fn(() =>
					Promise.resolve({
						ok: false,
						status: 422,
						statusText: 'Unprocessable Entity',
						text: () => Promise.resolve('{"errors":["invalid"]}')
					} as any)
				) as any;
				try {
					await axios.post('/foo', { bad: 'data' });
					throw new Error('should have rejected');
				} catch (err: any) {
					expect(err.response).toBeDefined();
					expect(err.response.status).toEqual(422);
					expect(err.response.data).toEqual({ errors: ['invalid'] });
				}
			} finally {
				globalThis.fetch = originalFetch;
			}
		});

		it('should include config in error', async () => {
			const originalFetch = globalThis.fetch;
			try {
				globalThis.fetch = jest.fn(() =>
					Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve('') } as any)
				) as any;
				try {
					await axios.get('/secret', { headers: { 'x-token': 'abc' } });
					throw new Error('should have rejected');
				} catch (err: any) {
					expect(err.config).toBeDefined();
					expect(err.config.headers).toEqual({ 'x-token': 'abc' });
				}
			} finally {
				globalThis.fetch = originalFetch;
			}
		});

		it('should respect custom validateStatus', async () => {
			const originalFetch = globalThis.fetch;
			try {
				globalThis.fetch = jest.fn(() =>
					Promise.resolve({ ok: true, status: 202, text: () => Promise.resolve('accepted') } as any)
				) as any;
				try {
					await axios.get('/foo', { validateStatus: (s) => s === 200 });
					throw new Error('should have rejected');
				} catch (err: any) {
					expect(err.status).toEqual(202);
					expect(err.code).toEqual('ERR_BAD_REQUEST');
					expect(err.isAxiosError).toBe(true);
				}
			} finally {
				globalThis.fetch = originalFetch;
			}
		});

		it('should support error toJSON()', async () => {
			const originalFetch = globalThis.fetch;
			try {
				globalThis.fetch = jest.fn(() =>
					Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') } as any)
				) as any;
				try {
					await axios.get('/missing');
					throw new Error('should have rejected');
				} catch (err: any) {
					const json = err.toJSON();
					expect(json.message).toEqual('Request failed with status code 404');
					expect(json.status).toEqual(404);
					expect(json.code).toEqual('ERR_BAD_REQUEST');
					expect(json.config).toBeDefined();
				}
			} finally {
				globalThis.fetch = originalFetch;
			}
		});

		it('axios.isAxiosError should identify redaxios errors', () => {
			expect(axios.isAxiosError(new Error('nope'))).toBe(false);
			expect(axios.isAxiosError(null)).toBe(false);
			expect(axios.isAxiosError(undefined)).toBe(false);
			expect(axios.isAxiosError({ isAxiosError: true })).toBe(true);
			expect(axios.isAxiosError({ isAxiosError: false })).toBe(false);
		});
	});

	describe('options.signal (request cancellation)', () => {
		it('should pass signal directly to fetch when no timeout is set', async () => {
			const controller = new AbortController();
			const fetchMock = jest.fn(() =>
				Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') } as any)
			);
			await axios.get('/foo', {
				signal: controller.signal,
				fetch: fetchMock as any
			});
			expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
		});

		it('should reject with ERR_CANCELED when signal is already aborted', async () => {
			const controller = new AbortController();
			controller.abort();
			try {
				await axios.get(`${baseUrl}/delay/200`, { signal: controller.signal });
				throw new Error('should have rejected');
			} catch (err: any) {
				expect(err.isAxiosError).toBe(true);
				expect(err.code).toEqual('ERR_CANCELED');
				expect(err.status).toEqual(0);
				expect(axios.isCancel(err)).toBe(true);
			}
		});

		it('should abort an in-flight request when signal is triggered', async () => {
			const controller = new AbortController();
			const promise = axios.get(`${baseUrl}/delay/5000`, { signal: controller.signal });
			setTimeout(() => controller.abort(), 10);
			try {
				await promise;
				throw new Error('should have rejected');
			} catch (err: any) {
				expect(err.isAxiosError).toBe(true);
				expect(err.code).toEqual('ERR_CANCELED');
				expect(err.message).toEqual('canceled');
				expect(axios.isCancel(err)).toBe(true);
			}
		});

		it('should not affect successful requests when signal is not aborted', async () => {
			const controller = new AbortController();
			const res = await axios.get(`${baseUrl}/example.txt`, { signal: controller.signal });
			expect(res.status).toEqual(200);
			expect(res.data).toEqual('some example content');
		});
	});

	describe('options.timeout', () => {
		it('should reject with ECONNABORTED when request exceeds timeout', async () => {
			try {
				await axios.get(`${baseUrl}/delay/5000`, { timeout: 50 });
				throw new Error('should have rejected');
			} catch (err: any) {
				expect(err.isAxiosError).toBe(true);
				expect(err.code).toEqual('ECONNABORTED');
				expect(err.message).toEqual('timeout of 50ms exceeded');
				expect(err.status).toEqual(0);
			}
		});

		it('should not timeout if request completes within the limit', async () => {
			const res = await axios.get(`${baseUrl}/delay/10`, { timeout: 5000 });
			expect(res.status).toEqual(200);
			expect(res.data).toEqual({ delayed: 10 });
		});

		it('should ignore timeout when set to 0', async () => {
			const res = await axios.get(`${baseUrl}/example.txt`, { timeout: 0 });
			expect(res.status).toEqual(200);
			expect(res.data).toEqual('some example content');
		});

		it('should work together with signal (timeout fires first)', async () => {
			const controller = new AbortController();
			try {
				await axios.get(`${baseUrl}/delay/5000`, {
					timeout: 50,
					signal: controller.signal
				});
				throw new Error('should have rejected');
			} catch (err: any) {
				expect(err.code).toEqual('ECONNABORTED');
				expect(axios.isCancel(err)).toBe(false);
			}
		});

		it('should work together with signal (cancel fires first)', async () => {
			const controller = new AbortController();
			const promise = axios.get(`${baseUrl}/delay/5000`, {
				timeout: 5000,
				signal: controller.signal
			});
			setTimeout(() => controller.abort(), 10);
			try {
				await promise;
				throw new Error('should have rejected');
			} catch (err: any) {
				expect(err.code).toEqual('ERR_CANCELED');
				expect(axios.isCancel(err)).toBe(true);
			}
		});
	});

	describe('axios.isCancel', () => {
		it('should return true for cancel errors', () => {
			expect(axios.isCancel({ code: 'ERR_CANCELED' })).toBe(true);
		});

		it('should return false for non-cancel errors', () => {
			expect(axios.isCancel({ code: 'ERR_NETWORK' })).toBe(false);
			expect(axios.isCancel({ code: 'ERR_BAD_REQUEST' })).toBe(false);
			expect(axios.isCancel({ code: 'ECONNABORTED' })).toBe(false);
			expect(axios.isCancel(new Error('nope'))).toBe(false);
			expect(axios.isCancel(null)).toBe(false);
			expect(axios.isCancel(undefined)).toBe(false);
		});
	});

});
