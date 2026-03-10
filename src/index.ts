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

export type Method =
	| 'get'
	| 'post'
	| 'put'
	| 'patch'
	| 'delete'
	| 'options'
	| 'head'
	| 'GET'
	| 'POST'
	| 'PUT'
	| 'PATCH'
	| 'DELETE'
	| 'OPTIONS'
	| 'HEAD';

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
	xsrfCookieName?: string;
	xsrfHeaderName?: string;
	validateStatus?: (status: number) => boolean;
	transformRequest?: Array<(body: any, headers?: RequestHeaders) => any>;
	baseURL?: string;
	fetch?: typeof globalThis.fetch;
	data?: any;
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
	code: 'ERR_BAD_REQUEST' | 'ERR_BAD_RESPONSE' | 'ERR_NETWORK';
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
	all: typeof Promise.all;
	spread: <Args, R>(fn: (...args: Args[]) => R) => (array: Args[]) => R;
	CancelToken: typeof AbortController;
	defaults: Options;
	create: (defaults?: Options) => RedaxiosInstance;
	isAxiosError: (value: any) => value is RedaxiosError;
}

function deepMerge(
	opts: Record<string, any>,
	overrides?: Record<string, any>,
	lowerCase?: boolean
): Record<string, any> {
	const out: Record<string, any> = {};
	if (Array.isArray(opts)) {
		return (opts as any[]).concat(overrides);
	}
	for (const i in opts) {
		const key = lowerCase ? i.toLowerCase() : i;
		out[key] = opts[i];
	}
	for (const i in overrides) {
		const key = lowerCase ? i.toLowerCase() : i;
		const value = overrides[i];
		out[key] = key in out && typeof value === 'object' ? deepMerge(out[key], value, key === 'headers') : value;
	}
	return out;
}

function createError(
	message: string,
	config: Options,
	response: Response,
	status: number,
	code?: RedaxiosError['code']
): RedaxiosError {
	const err = Object.assign(new Error(message), {
		config,
		response,
		status,
		code: code || (status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST'),
		isAxiosError: true as const,
		toJSON() {
			return { message: err.message, config, code: err.code, status };
		}
	});
	return err as RedaxiosError;
}

function create(defaults?: Options): RedaxiosInstance {
	defaults = defaults || {};

	function redaxios<T = any>(
		urlOrConfig: string | Options,
		config?: Options,
		_method?: string,
		data?: any
	): Promise<Response<T>> {
		let url: string;
		if (typeof urlOrConfig === 'string') {
			url = urlOrConfig;
		} else {
			config = urlOrConfig;
			url = urlOrConfig.url!;
		}

		const options: Options = deepMerge(defaults as Record<string, any>, config as Record<string, any>) as Options;
		const response = { config: options } as Response<any>;
		const customHeaders: Record<string, string> = {};

		data = data || options.data;

		for (const f of options.transformRequest || []) {
			data = f(data, options.headers) || data;
		}

		if (options.auth) {
			customHeaders.authorization = options.auth;
		}

		if (data && typeof data === 'object' && typeof data.append !== 'function' && typeof data.text !== 'function') {
			data = JSON.stringify(data);
			customHeaders['content-type'] = 'application/json';
		}

		try {
			customHeaders[options.xsrfHeaderName!] = decodeURIComponent(
				document.cookie.match(RegExp(`(^|; )${options.xsrfCookieName}=([^;]*)`))![2]
			);
		} catch (_e) {}

		if (options.baseURL) {
			url = url.replace(/^(?!.*\/\/)\/?/, `${options.baseURL}/`);
		}

		if (options.params) {
			url +=
				(~url.indexOf('?') ? '&' : '?') +
				(options.paramsSerializer
					? options.paramsSerializer(options.params)
					: new URLSearchParams(options.params as Record<string, string>));
		}

		const fetchFunc = options.fetch || fetch;

		return fetchFunc(url, {
			method: (_method || (options.method as string) || 'get').toUpperCase(),
			body: data,
			headers: deepMerge(options.headers as Record<string, string>, customHeaders, true) as Record<string, string>,
			credentials: options.withCredentials ? 'include' : undefined
		})
			.then((res) => {
				for (const i in res) {
					if (typeof (res as any)[i] !== 'function') (response as any)[i] = (res as any)[i];
				}

				if (options.responseType === 'stream') {
					response.data = res.body;
					return response;
				}

				return (res as any)
					[options.responseType || 'text']()
					.then((parsed: any) => {
						response.data = parsed;
						// its okay if this fails: response.data will be the unparsed value:
						response.data = JSON.parse(parsed);
					})
					.catch(Object)
					.then(() => {
						const ok = options.validateStatus ? options.validateStatus(res.status) : res.ok;
						if (ok) return response;
						return Promise.reject(
							createError(`Request failed with status code ${res.status}`, options, response, res.status)
						);
					});
			})
			.catch((err) => {
				if (err.isAxiosError) return Promise.reject(err);
				return Promise.reject(createError(err.message || 'Network Error', options, response, 0, 'ERR_NETWORK'));
			});
	}

	const instance = redaxios as unknown as RedaxiosInstance;

	instance.request = instance;
	instance.get = (url, config) => redaxios(url, config, 'get');
	instance.delete = (url, config) => redaxios(url, config, 'delete');
	instance.head = (url, config) => redaxios(url, config, 'head');
	instance.options = (url, config) => redaxios(url, config, 'options');
	instance.post = (url, data, config) => redaxios(url, config, 'post', data);
	instance.put = (url, data, config) => redaxios(url, config, 'put', data);
	instance.patch = (url, data, config) => redaxios(url, config, 'patch', data);
	instance.all = Promise.all.bind(Promise);
	instance.spread = (fn) => (fn as any).apply.bind(fn, fn);
	instance.CancelToken = (typeof AbortController === 'function' ? AbortController : Object) as typeof AbortController;
	instance.defaults = defaults;
	instance.create = create;
	instance.isAxiosError = (value: any): value is RedaxiosError => value?.isAxiosError === true;

	return instance;
}

export default create();
