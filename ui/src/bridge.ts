import type { ChatConversation, ChatSendResult, RyuBridge } from "./ryu.d.ts";

function ryu(): RyuBridge {
	const bridge = typeof window === "undefined" ? undefined : window.ryu;
	if (!bridge?.chat) {
		throw new Error(
			"Chat Broadcast needs the chat.sendFollowUp permission from the host."
		);
	}
	return bridge;
}

export function listChatConversations(): Promise<ChatConversation[]> {
	return ryu().chat.list();
}

export function sendChatMessage(input: {
	conversationId: string;
	text: string;
}): Promise<ChatSendResult> {
	return ryu().chat.send(input);
}
