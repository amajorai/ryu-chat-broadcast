import { describe, expect, it } from "bun:test";
import {
	selectBroadcastTargets,
	visibleBroadcastConversations,
} from "./selection.ts";

const runningConversation = {
	archived: false,
	id: "running",
	run_status: "running",
};
const idleConversation = { archived: false, id: "idle", run_status: "idle" };
const archivedConversation = {
	archived: true,
	id: "archived-running",
	run_status: "running",
};
const conversations = [
	runningConversation,
	idleConversation,
	archivedConversation,
];

describe("Chat Broadcast target selection", () => {
	it("defaults to every visible running chat", () => {
		expect(selectBroadcastTargets(conversations, "running", new Set())).toEqual(
			[runningConversation]
		);
	});

	it("allows selected idle chats but never archived chats", () => {
		expect(
			selectBroadcastTargets(
				conversations,
				"selected",
				new Set(["idle", "archived-running"])
			)
		).toEqual([idleConversation]);
	});

	it("filters archived chats from the visible list", () => {
		expect(visibleBroadcastConversations(conversations)).toEqual([
			runningConversation,
			idleConversation,
		]);
	});
});
