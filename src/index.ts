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
type RequestHeaders = Record<string, string>;

export type Method =
	| "get"
	| "post"
	| "put"
	| "patch"
	| "delete"
	| "options"
	| "head"
	| "GET"
	| "POST"
	| "PUT"
	| "PATCH"
	| "DELETE"
	| "OPTIONS"
	| "HEAD";

export type ResponseType =
	| "arrayBuffer"
	| "blob"
	| "json"
	| "text"
	| "formData"
	| "stream";

export type RedaxiosRequestConfig<D = any> = {
	/** The URL to request */
	url?: string;
	/** Method */
	method?: Method | string;
	/** A base URL from which to resolve all URLs */
	baseURL?: string;
	/** An array of transformations to apply to the outgoing request */
	transformRequest?: Array<(body: any, headers?: RequestHeaders) => any>;
	/** Request headers */
	headers?: RequestHeaders;
	/** Querystring parameters */
	params?: Record<string, any> | URLSearchParams;
	/** Custom function to stringify querystring parameters */
	paramsSerializer?: (params: RedaxiosRequestConfig["params"]) => string;
	/** Data */
	data?: D;
	/** Send the request with credentials like cookies */
	withCredentials?: boolean;
	/** Authorization header value to send with the request */
	auth?: string;
	/**
	 * An encoding to use for the response
	 * @default 'json'
	 */
	responseType?: ResponseType;
	/** Pass an Cross-site Request Forgery prevention cookie value as a header defined by `xsrfHeaderName` */
	xsrfCookieName?: string;
	/** The name of a header to use for passing XSRF cookies */
	xsrfHeaderName?: string;
	/** Override status code handling (default: 200-399 is a success) */
	validateStatus?: (status: number) => boolean;
	/** Custom window.fetch implementation */
	fetch?: typeof window.fetch;
	signal?: AbortSignal;
};

export type RedaxiosResponse<T = any, D = any> = {
	/** Data the decoded response body */
	data: T;
	/** Body */
	body: ReadableStream<Uint8Array> | undefined;
	/** Status */
	status: Response["status"];
	/** StatusText */
	statusText: Response["statusText"];
	/** Headers */
	headers: Response["headers"];
	/** Config the request configuration */
	config: RedaxiosRequestConfig<D>;
	/** Redirect */
	redirected: Response["redirected"];
	/** Url */
	url: Response["url"];
	type: Response["type"];
};

export class RedaxiosError<T = unknown, D = any> extends Error {
	config: RedaxiosRequestConfig<D>;
	response: RedaxiosResponse<T>;
	isAxiosError: boolean;

	constructor(
		message: string,
		response: RedaxiosResponse<T, D>,
		config: RedaxiosRequestConfig<D>,
	) {
		super(message);
		this.name = "RedaxiosError";
		this.config = config;
		this.response = response;
		this.isAxiosError = true;
	}
}

type BodylessMethod = <T = any, D = any>(
	url: string,
	config?: RedaxiosRequestConfig<D>,
) => Promise<RedaxiosResponse<T, D>>;

function deepMerge<
	T extends Record<string, unknown>,
	U extends Record<string, unknown>,
>(opts: T, overrides: U, lowerCase?: boolean): T & U {
	const out = {} as T & U;
	let i: keyof T & keyof U;
	if (Array.isArray(opts)) {
		// @ts-expect-error
		return opts.concat(overrides);
	}

	for (i in opts) {
		const key = lowerCase ? i.toLowerCase() : i;
		// @ts-expect-error
		out[key] = opts[i];
	}

	for (i in overrides) {
		const key: keyof T & keyof U = lowerCase ? i.toLowerCase() : i;
		// @ts-ignore
		const value = overrides[i];
		// @ts-ignore
		out[key] =
			key in out && typeof value === "object"
				? // @ts-ignore
				  deepMerge(out[key], value, key === "headers")
				: value;
	}

	return out;
}

export type Redaxios = {
	<T = any, D = any>(
		config: RedaxiosRequestConfig<D>,
	): Promise<RedaxiosResponse<T, D>>;
	<T = any, D = any>(
		url: string,
		config?: RedaxiosRequestConfig<D>,
	): Promise<RedaxiosResponse<T, D>>;
	get: BodylessMethod;
	delete: BodylessMethod;
	head: BodylessMethod;
	options: BodylessMethod;
	post: <T = any, D = any>(
		url: string,
		data?: any,
		config?: RedaxiosRequestConfig<D>,
	) => Promise<RedaxiosResponse<T, D>>;
	put: <T = any, D = any>(
		url: string,
		data?: any,
		config?: RedaxiosRequestConfig<D>,
	) => Promise<RedaxiosResponse<T, D>>;
	patch: <T = any, D = any>(
		url: string,
		data?: any,
		config?: RedaxiosRequestConfig<D>,
	) => Promise<RedaxiosResponse<T, D>>;
	all: typeof Promise.all;
	defaults: RedaxiosRequestConfig;
	create: (defaults?: RedaxiosRequestConfig) => Redaxios;
};

function create(defaults: RedaxiosRequestConfig = {}): Redaxios {
	defaults ||= {};

	redaxios.request = redaxios;

	redaxios.get = async <T = any, D = any>(
		url: string,
		config?: RedaxiosRequestConfig<D>,
	) => redaxios<T, D>(url, { ...config, method: "get" });

	redaxios.delete = async <T = any, D = any>(
		url: string,
		config?: RedaxiosRequestConfig<D>,
	) => redaxios<T, D>(url, { ...config, method: "delete" });

	redaxios.head = async <T = any, D = any>(
		url: string,
		config?: RedaxiosRequestConfig<D>,
	) => redaxios<T, D>(url, { ...config, method: "head" });

	redaxios.options = async <T = any, D = any>(
		url: string,
		config?: RedaxiosRequestConfig<D>,
	) => redaxios<T, D>(url, { ...config, method: "options" });

	redaxios.post = async <T = any, D = any>(
		url: string,
		data?: D,
		config?: RedaxiosRequestConfig<D>,
	) => redaxios<T, D>(url, { ...config, method: "post", data });

	redaxios.put = async <T = any, D = any>(
		url: string,
		data?: D,
		config?: RedaxiosRequestConfig<D>,
	) => redaxios<T, D>(url, { ...config, method: "put", data });

	redaxios.patch = async <T = any, D = any>(
		url: string,
		data?: D,
		config?: RedaxiosRequestConfig<D>,
	) => redaxios<T, D>(url, { ...config, method: "patch", data });

	redaxios.all = Promise.all.bind(Promise);

	/**
	 * Issues a request.
	 */
	async function redaxios<T = any, D = any>(
		urlOrConfig: string | RedaxiosRequestConfig<D>,
		config?: RedaxiosRequestConfig<D>,
	): Promise<RedaxiosResponse<T, D>> {
		let url =
			typeof urlOrConfig !== "string"
				? (config = urlOrConfig).url!
				: urlOrConfig;

		const response = { config } as RedaxiosResponse<T, D>;

		const options: RedaxiosRequestConfig<D> = deepMerge(defaults, config || {});

		const customHeaders: RequestHeaders = {};

		let body = options.data;

		(options.transformRequest || []).map((f) => {
			body = f(body, options.headers) || body;
		});

		if (options.auth) {
			customHeaders.authorization = options.auth;
		}

		if (
			body &&
			typeof body === "object" &&
			typeof (body as any)?.append !== "function" &&
			typeof (body as any)?.text !== "function"
		) {
			body = JSON.stringify(body) as any;
			customHeaders["content-type"] = "application/json";
		}

		if (options.xsrfHeaderName) {
			try {
				customHeaders[options.xsrfHeaderName] = decodeURIComponent(
					// @ts-expect-error accessing match()[2] throws for no match, which is intentional
					RegExp(`(^|; )${options.xsrfCookieName}=([^;]*)`).exec(
						document.cookie,
					)[2],
				);
			} catch (e) {}
		}

		if (options.baseURL) {
			url = url.replace(/^(?!.*\/\/)\/?/, `${options.baseURL}/`);
		}

		if (options.params) {
			url +=
				(~url.indexOf("?") ? "&" : "?") +
				(options.paramsSerializer
					? options.paramsSerializer(options.params)
					: new URLSearchParams(options.params));
		}

		const fetchFunc = options.fetch || fetch;

		return fetchFunc(url, {
			method: (options.method || "get").toUpperCase(),
			body: body as unknown as BodyInit,
			headers: deepMerge(options.headers || {}, customHeaders, true),
			credentials: options.withCredentials ? "include" : undefined,
			signal: options.signal,
		}).then(async (res) => {
			for (const i in res) {
				// @ts-expect-error
				if (typeof res[i] !== "function") response[i] = res[i];
			}

			if (options.responseType === "stream") {
				response.data = res.body as any;
				return response;
			}

			return res[options.responseType || "text"]()
				.then((data) => {
					response.data = data;
					// Its okay if this fails: response.data will be the unparsed value:
					if (options.responseType !== "text") response.data = JSON.parse(data);
				})
				.catch(Object)
				.then(async () => {
					const ok = options.validateStatus
						? options.validateStatus(res.status)
						: res.ok;
					return ok
						? response
						: Promise.reject(
								new RedaxiosError("ERR_REDAXIOS_FAILED", response, options),
						  );
				});
		});
	}

	redaxios.defaults = defaults;

	redaxios.create = create;

	return redaxios;
}

export function isAxiosError<T = any, D = any>(
	e: any,
): e is { response: RedaxiosResponse<T, D> } {
	return e?.response && e.isAxiosError === true;
}

export default create();
