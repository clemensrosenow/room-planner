import { deviceId } from './device';
import type { DesignData, DesignPage, PublishRequest, Sort } from './types';

export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly body: Record<string, unknown> = {}
	) {
		super(message);
	}
}

/** JSON request to our API, identified by this Device. */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	let res: Response;
	try {
		res = await fetch(path, {
			method,
			headers: {
				accept: 'application/json',
				'x-device-id': deviceId(),
				...(body !== undefined && { 'content-type': 'application/json' })
			},
			body: body === undefined ? undefined : JSON.stringify(body)
		});
	} catch {
		throw new ApiError(0, 'No connection. Check your internet and try again.');
	}
	const data = await res.json().catch(() => ({}));
	if (!res.ok)
		throw new ApiError(res.status, data.message || `Something went wrong (${res.status})`, data);
	return data as T;
}

export const listDesigns = (sort: Sort) => request<DesignPage>('GET', `/api/designs?sort=${sort}`);
export const getDesign = (id: string) => request<DesignData>('GET', `/api/designs/${id}`);
export const publishDesign = (req: PublishRequest) =>
	request<{ id: string; slug: string }>('POST', '/api/designs', req);
export const deleteDesign = (id: string) => request<{ ok: true }>('DELETE', `/api/designs/${id}`);
