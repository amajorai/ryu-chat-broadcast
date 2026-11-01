export type BroadcastScope = "running" | "selected";

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
