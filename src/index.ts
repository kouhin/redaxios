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

interface RequestHeaders {
	[name: string]: string;
}
type HttpMethod =
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

interface Options {
	/** the URL to request */
	url?: string;
	/** method */
	method?: HttpMethod;
	/** Request headers */
	headers?: RequestHeaders;
	/** a body, optionally encoded, to send */
	body?: FormData | string | object;
	/**
	 * An encoding to use for the response
	 * @default 'json'
	 */
	responseType?: 'text' | 'json' | 'stream' | 'blob' | 'arrayBuffer' | 'formData' | 'stream';
	/** querystring parameters */
	params?: Record<string, any> | URLSearchParams;
	/** custom function to stringify querystring parameters */
	paramsSerializer?: (params: Options['params']) => string;
	/** Send the request with credentials like cookies */
	withCredentials?: boolean;
	/** Authorization header value to send with the request */
	auth?: string;
	/** Pass an Cross-site Request Forgery prevention cookie value as a header defined by `xsrfHeaderName` */
	xsrfCookieName?: string;
	/** The name of a header to use for passing XSRF cookies */
	xsrfHeaderName?: string;
	/** Override status code handling (default: 200-399 is a success) */
	validateStatus?: (status: number) => boolean;
	/** An array of transformations to apply to the outgoing request */
	transformRequest?: Array<(body: any, headers?: RequestHeaders) => any>;
	/** a base URL from which to resolve all URLs */
	baseURL?: string;
	/** Custom window.fetch implementation */
	fetch?: typeof window.fetch;
	/** data */
	data?: any;
}

interface Response<T> {
	/** status */
	status: number;
	/** statusText */
	statusText: string;
	/** config the request configuration */
	config: Options;
	/** data the decoded response body */
	data: T;
	/** headers */
	headers: Headers;
	/** redirect */
	redirect: boolean;
	/** url */
	url: string;
	/** type */
	type: ResponseType;
	/** body */
	body: ReadableStream<Uint8Array> | null;
	/** bodyUsed */
	bodyUsed: boolean;
}

type UrlOrConfig = string | (Options & { url: string });

type BodylessMethod = <T = any>(url: UrlOrConfig, config?: Options) => Promise<Response<T>>;

interface Redaxios {
	<T = any>(url: UrlOrConfig, config?: Options, method?: HttpMethod, data?: unknown, _undefined?: undefined): Promise<
		Response<T>
	>;
	get: BodylessMethod;
	delete: BodylessMethod;
	head: BodylessMethod;
	options: BodylessMethod;
	post: <T = any>(url: UrlOrConfig, data?: any, config?: Options) => Promise<Response<T>>;
	put: <T = any>(url: UrlOrConfig, data?: any, config?: Options) => Promise<Response<T>>;
	patch: <T = any>(url: UrlOrConfig, data?: any, config?: Options) => Promise<Response<T>>;
	all: typeof Promise.all;
	spread: <Args, R>(fn: (...args: Args[]) => R) => (array: Args[]) => R;
	CancelToken: typeof AbortController;
	defaults: Options;
	create: (defaults?: Options) => Redaxios;
}

function create(defaults: Options = {}): Redaxios {
	defaults = defaults || {};

	redaxios.request = redaxios;

	redaxios.get = <T = any>(url: UrlOrConfig, config?: Options) => redaxios<T>(url, config, 'get');

	redaxios.delete = <T = any>(url: UrlOrConfig, config?: Options) => redaxios<T>(url, config, 'delete');

	redaxios.head = <T = any>(url: UrlOrConfig, config?: Options) => redaxios<T>(url, config, 'head');

	redaxios.options = <T = any>(url: UrlOrConfig, config?: Options) => redaxios<T>(url, config, 'options');

	redaxios.post = <T = any>(url: UrlOrConfig, data?: any, config?: Options) => redaxios<T>(url, config, 'post', data);

	redaxios.put = <T = any>(url: UrlOrConfig, data?: any, config?: Options) => redaxios<T>(url, config, 'put', data);

	redaxios.patch = <T = any>(url: UrlOrConfig, data?: any, config?: Options) => redaxios<T>(url, config, 'patch', data);

	redaxios.all = Promise.all.bind(Promise);

	redaxios.spread = <Args, R>(fn: (...args: Args[]) => R) => fn.apply.bind(fn, fn) as (array: Args[]) => R;

	function deepMerge<T extends Object, U extends Object>(opts: T, overrides: U, lowerCase?: boolean): T & U {
		let out: T & U = {} as T & U,
			i;
		if (Array.isArray(opts)) {
			// @ts-ignore
			return opts.concat(overrides);
		}
		for (i in opts) {
			const key = lowerCase ? i.toLowerCase() : i;
			out[key] = opts[i];
		}
		for (i in overrides) {
			const key = lowerCase ? i.toLowerCase() : i;
			const value = overrides[i];
			out[key] = key in out && typeof value == 'object' ? deepMerge(out[key], value, key == 'headers') : value;
		}
		return out;
	}

	/**
	 * Issues a request.
	 */
	async function redaxios<T>(
		urlOrConfig: UrlOrConfig,
		config?: Options,
		_method?: HttpMethod,
		data?: unknown,
		_undefined?: undefined
	): Promise<Response<T>> {
		let url = typeof urlOrConfig != 'string' ? (config = urlOrConfig).url : urlOrConfig;

		const response: Response<T> = { config: config } as Response<T>;

		const options: Options = deepMerge(defaults, config || {});

		const customHeaders: RequestHeaders = {};

		data = data || options.data;

		(options.transformRequest || []).map((f) => {
			data = f(data, options.headers) || data;
		});

		if (options.auth) {
			customHeaders.authorization = options.auth;
		}

		if (
			data &&
			typeof data === 'object' &&
			typeof (data as any)?.append !== 'function' &&
			typeof (data as any)?.text !== 'function'
		) {
			data = JSON.stringify(data);
			customHeaders['content-type'] = 'application/json';
		}

		try {
			// @ts-ignore providing the cookie name without header name is nonsensical anyway
			customHeaders[options.xsrfHeaderName] = decodeURIComponent(
				// @ts-ignore accessing match()[2] throws for no match, which is intentional
				document.cookie.match(RegExp('(^|; )' + options.xsrfCookieName + '=([^;]*)'))[2]
			);
		} catch (e) {}

		if (options.baseURL) {
			url = url.replace(/^(?!.*\/\/)\/?/, options.baseURL + '/');
		}

		if (options.params) {
			url +=
				(~url.indexOf('?') ? '&' : '?') +
				(options.paramsSerializer ? options.paramsSerializer(options.params) : new URLSearchParams(options.params));
		}

		const fetchFunc = options.fetch || fetch;

		return fetchFunc(url, {
			method: (_method || options.method || 'get').toUpperCase(),
			body: data as BodyInit,
			headers: deepMerge(options.headers || {}, customHeaders, true),
			credentials: options.withCredentials ? 'include' : _undefined
		}).then((res) => {
			for (const i in res) {
				if (typeof res[i] != 'function') response[i] = res[i];
			}

			if (options.responseType == 'stream') {
				response.data = res.body as any;
				return response;
			}

			return res[options.responseType || 'text']()
				.then((data) => {
					response.data = data;
					// its okay if this fails: response.data will be the unparsed value:
					response.data = JSON.parse(data);
				})
				.catch(Object)
				.then(() => {
					const ok = options.validateStatus ? options.validateStatus(res.status) : res.ok;
					return ok ? response : Promise.reject(response);
				});
		});
	}

	redaxios.CancelToken = (typeof AbortController == 'function' ? AbortController : Object) as typeof AbortController;

	redaxios.defaults = defaults;

	redaxios.create = create;

	return redaxios;
}

export default create();
