import type { AppErrorCode, ChannelResult, ChannelRpc, Continent } from '@announcing/core';
import { AppError, placementFor } from '@announcing/core';
import { error } from '@sveltejs/kit';

let warnedNoJurisdiction = false;

function namespaceFor(env: Env, jurisdiction: 'eu' | undefined): DurableObjectNamespace {
	if (!jurisdiction)
		return env.CHANNEL;
	try {
		return env.CHANNEL.jurisdiction(jurisdiction);
	}
	catch (err) {
		// Local workerd only: "Jurisdiction restrictions are not implemented in
		// workerd." — fall back to the plain namespace so EU channels are
		// developable offline. Production workerd supports jurisdictions; any
		// other failure must stay fatal (EU data may not silently leave the EU).
		if (!(err instanceof Error) || !/not implemented/i.test(err.message))
			throw err;
		if (!warnedNoJurisdiction) {
			warnedNoJurisdiction = true;
			console.warn('DO jurisdictions are not implemented in local workerd; using the plain namespace (dev only)');
		}
		return env.CHANNEL;
	}
}

/**
 * Resolve the ChannelDO stub for a channel. The placement (EU jurisdiction vs
 * location hint) is derived from the channel's immutable region and must be
 * applied identically on every call — a jurisdiction is part of the DO id.
 */
export function channelStub(env: Env, channelId: string, region: Continent): ChannelRpc {
	const placement = placementFor(region);
	const ns = namespaceFor(env, placement.jurisdiction);
	const stub = ns.get(ns.idFromName(channelId), placement.locationHint ? { locationHint: placement.locationHint } : undefined);
	return stub as unknown as ChannelRpc;
}

const HTTP_STATUS: Record<AppErrorCode, number> = {
	forbidden: 403,
	not_found: 404,
	conflict: 409,
	invalid: 400,
	expired: 410,
	already_member: 409,
	last_owner: 409,
	uninitialized: 404,
};

/**
 * Await a ChannelDO call and unwrap its ChannelResult, translating failure
 * codes into HTTP errors. Codes the caller wants to handle itself (e.g.
 * `already_member` on invite accept) can be listed in `passthrough` — they
 * are then thrown as AppError instead.
 */
export async function rpc<T>(promise: Promise<ChannelResult<T>>, passthrough: AppErrorCode[] = []): Promise<T> {
	const result = await promise;
	if (result.ok)
		return result.value;
	if (!passthrough.includes(result.code))
		error(HTTP_STATUS[result.code], { message: result.code });
	throw new AppError(result.code);
}
