export type BroadcastScope = "running" | "selected";

export interface DeliveryResult {
	error?: string;
	id: string;
	status: "accepted" | "failed";
}

/** How many targets of the last broadcast accepted the message. */
export function acceptedCount(results: readonly DeliveryResult[]): number {
	return results.filter((result) => result.status === "accepted").length;
}

export interface BroadcastConversationLike {
	archived?: boolean;
	id: string;
	run_status: string | null;
}

export function visibleBroadcastConversations<
	T extends BroadcastConversationLike,
>(conversations: readonly T[]): T[] {
	return conversations.filter((conversation) => !conversation.archived);
}

export function selectBroadcastTargets<T extends BroadcastConversationLike>(
	conversations: readonly T[],
	scope: BroadcastScope,
	selectedIds: ReadonlySet<string>
): T[] {
	const visible = visibleBroadcastConversations(conversations);
	if (scope === "running") {
		return visible.filter(
			(conversation) => conversation.run_status === "running"
		);
	}
	return visible.filter((conversation) => selectedIds.has(conversation.id));
}
