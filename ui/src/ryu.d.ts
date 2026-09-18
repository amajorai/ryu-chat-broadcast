export interface ChatConversation {
	agent_id: string | null;
	archived?: boolean;
	created_at: number;
	id: string;
	last_message?: string;
	last_message_at?: number;
	last_message_role?: string;
	message_count: number;
	run_status: string | null;
	title: string | null;
	updated_at: number;
}

export interface ChatSendResult {
	conversation_id: string;
	status: "accepted";
}

export interface RyuBridge {
	chat: {
		list(): Promise<ChatConversation[]>;
		send(input: {
			conversationId: string;
			text: string;
		}): Promise<ChatSendResult>;
	};
}

declare global {
	interface Window {
		ryu?: RyuBridge;
	}
}
