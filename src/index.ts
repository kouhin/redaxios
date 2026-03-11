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
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * This file has been modified by kouhin (https://github.com/kouhin/redaxios).
 * Modifications:
 * - Rewritten from JavaScript to TypeScript with full type definitions.
 * - Added axios-compatible error handling (RedaxiosError, createError, isAxiosError).
 */

type LC = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head';
export type Method = LC | Uppercase<LC>;
export type ResponseType = 'text' | 'json' | 'stream' | 'blob' | 'arrayBuffer' | 'formData';
export type RequestHeaders = Record<string, string> | Headers;

export interface Options {
	url?: string;
	method?: Method;
	headers?: RequestHeaders;
	body?: FormData | string | object;
	responseType?: ResponseType;
	params?: Record<string, any> | URLSearchParams;
	paramsSerializer?: (params: Options['params']) => string;
	withCredentials?: boolean;
	auth?: string;
	validateStatus?: (status: number) => boolean;
	transformRequest?: Array<(body: any, headers?: RequestHeaders) => any>;
	baseURL?: string;
	fetch?: typeof globalThis.fetch;
	data?: any;
	signal?: AbortSignal;
	timeout?: number;
}

export interface Response<T = any> {
	status: number;
	statusText: string;
	config: Options;
	data: T;
	headers: Headers;
	redirect: boolean;
	url: string;
	type: globalThis.ResponseType;
	body: ReadableStream<Uint8Array> | null;
	bodyUsed: boolean;
}

export interface RedaxiosError<T = any> extends Error {
	config: Options;
	response: Response<T>;
	status: number;
	code: 'ERR_BAD_REQUEST' | 'ERR_BAD_RESPONSE' | 'ERR_NETWORK' | 'ERR_CANCELED' | 'ECONNABORTED';
	isAxiosError: true;
}

export type BodylessMethod = <T = any>(url: string, config?: Options) => Promise<Response<T>>;
export type BodyMethod = <T = any>(url: string, body?: any, config?: Options) => Promise<Response<T>>;

export interface RedaxiosInstance {
	<T = any>(config: Options): Promise<Response<T>>;
	<T = any>(url: string, config?: Options): Promise<Response<T>>;
	request: RedaxiosInstance;
	get: BodylessMethod;
	delete: BodylessMethod;
	head: BodylessMethod;
	options: BodylessMethod;
	post: BodyMethod;
	put: BodyMethod;
	patch: BodyMethod;
	defaults: Options;
	create: (defaults?: Options) => RedaxiosInstance;
	isAxiosError: (value: any) => value is RedaxiosError;
	isCancel: (value: any) => boolean;
}

function deepMerge(opts: Record<string, any>, overrides?: Record<string, any>, lc?: boolean): Record<string, any> {
	if (Array.isArray(opts)) return (opts as any[]).concat(overrides);
	const out: Record<string, any> = {};
	for (const i in opts) out[lc ? i.toLowerCase() : i] = opts[i];
	for (const i in overrides) {
		const k = lc ? i.toLowerCase() : i,
			v = overrides[i];
		out[k] = k in out && typeof v === 'object' ? deepMerge(out[k], v, k === 'headers') : v;
	}
	return out;
}

function createError(
	msg: string,
	config: Options,
	response: Response,
	status: number,
	code?: RedaxiosError['code']
): RedaxiosError {
	const err = Object.assign(new Error(msg), {
		config,
		response,
		status,
		code: code || (status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST'),
		isAxiosError: true as const,
		toJSON: () => ({ message: err.message, config, code: err.code, status })
	});
	return err as RedaxiosError;
}

function create(defaults: Options = {}): RedaxiosInstance {
	function redaxios<T = any>(
		urlOrConfig: string | Options,
		config?: Options,
		_method?: string,
		_data?: any
	): Promise<Response<T>> {
		if (typeof urlOrConfig !== 'string') config = urlOrConfig;
		let url = typeof urlOrConfig === 'string' ? urlOrConfig : urlOrConfig.url!;
		const opts = deepMerge(defaults as Record<string, any>, config as Record<string, any>) as Options;
		const resp = { config: opts } as Response<any>;
		const hdrs: Record<string, string> = {};
		let data = _data || opts.data;

		for (const f of opts.transformRequest || []) data = f(data, opts.headers) || data;
		if (opts.auth) hdrs.authorization = opts.auth;
		if (data && typeof data === 'object' && typeof data.append !== 'function' && typeof data.text !== 'function') {
			data = JSON.stringify(data);
			hdrs['content-type'] = 'application/json';
		}
		if (opts.baseURL) url = url.replace(/^(?!.*\/\/)\/?/, `${opts.baseURL}/`);
		if (opts.params)
			url +=
				(~url.indexOf('?') ? '&' : '?') +
				(opts.paramsSerializer
					? opts.paramsSerializer(opts.params)
					: new URLSearchParams(opts.params as Record<string, string>));

		const sig =
			opts.timeout && opts.signal
				? AbortSignal.any([opts.signal, AbortSignal.timeout(opts.timeout)])
				: opts.timeout
					? AbortSignal.timeout(opts.timeout)
					: opts.signal;

		return (opts.fetch || fetch)(url, {
			method: (_method || (opts.method as string) || 'get').toUpperCase(),
			body: data,
			headers: deepMerge(opts.headers as Record<string, string>, hdrs, true) as Record<string, string>,
			credentials: opts.withCredentials ? 'include' : undefined,
			signal: sig
		})
			.then((res) => {
				for (const i in res) if (typeof (res as any)[i] !== 'function') (resp as any)[i] = (res as any)[i];
				if (opts.responseType === 'stream') {
					resp.data = res.body;
					return resp;
				}
				return (res as any)
					[opts.responseType || 'text']()
					.then((d: any) => {
						resp.data = d;
						resp.data = JSON.parse(d);
					})
					.catch(Object)
					.then(() =>
						(opts.validateStatus ? opts.validateStatus(res.status) : res.ok)
							? resp
							: Promise.reject(createError(`Request failed with status code ${res.status}`, opts, resp, res.status))
					);
			})
			.catch((err) =>
				Promise.reject(
					err.isAxiosError
						? err
						: err.name === 'TimeoutError'
							? createError(`timeout of ${opts.timeout}ms exceeded`, opts, resp, 0, 'ECONNABORTED')
							: sig?.aborted
								? createError('canceled', opts, resp, 0, 'ERR_CANCELED')
								: createError(err.message || 'Network Error', opts, resp, 0, 'ERR_NETWORK')
				)
			);
	}

	const ax = redaxios as unknown as RedaxiosInstance;
	ax.request = ax;
	for (const m of ['get', 'delete', 'head', 'options'] as const) ax[m] = (u, c) => redaxios(u, c, m);
	for (const m of ['post', 'put', 'patch'] as const) ax[m] = (u, d, c) => redaxios(u, c, m, d);
	ax.defaults = defaults;
	ax.create = create;
	ax.isAxiosError = (v: any): v is RedaxiosError => v?.isAxiosError === true;
	ax.isCancel = (v: any) => v?.code === 'ERR_CANCELED';
	return ax;
}

export default create();
