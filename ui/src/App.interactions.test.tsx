import { afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { Root } from "react-dom/client";
import type { ChatConversation, RyuBridge } from "./ryu.d.ts";

if (!GlobalRegistrator.isRegistered) {
	GlobalRegistrator.register();
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { App } = await import("./App.tsx");

const CONVERSATIONS: ChatConversation[] = [
	{
		agent_id: "ryu",
		created_at: 1,
		id: "running-1",
		message_count: 3,
		run_status: "running",
		title: "Running review",
		updated_at: 2,
	},
	{
		agent_id: "codex",
		created_at: 1,
		id: "idle-1",
		message_count: 2,
		run_status: "idle",
		title: "Idle planning",
		updated_at: 2,
	},
	{
		agent_id: "claude",
		created_at: 1,
		id: "idle-2",
		message_count: 5,
		run_status: null,
		title: "Idle research",
		updated_at: 2,
	},
	{
		agent_id: "archived-agent",
		archived: true,
		created_at: 1,
		id: "archived-1",
		message_count: 8,
		run_status: "running",
		title: "Archived chat",
		updated_at: 2,
	},
];

interface MountedApp {
	container: HTMLDivElement;
	root: Root;
}

const mountedApps: MountedApp[] = [];

function installBridge() {
	const listCalls: number[] = [];
	const sendCalls: { conversationId: string; text: string }[] = [];
	let failNextList = false;
	window.ryu = {
		chat: {
			list: async () => {
				listCalls.push(listCalls.length + 1);
				if (failNextList) {
					failNextList = false;
					throw new Error("Chat host is temporarily unavailable.");
				}
				return CONVERSATIONS;
			},
			send: async ({ conversationId, text }) => {
				sendCalls.push({ conversationId, text });
				if (conversationId === "idle-2") {
					throw new Error("This conversation is no longer writable.");
				}
				return { conversation_id: conversationId, status: "accepted" };
			},
		},
	} satisfies RyuBridge;
	return {
		failNextList: () => {
			failNextList = true;
		},
		listCalls,
		sendCalls,
	};
}

async function tick(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

async function mountApp(): Promise<HTMLDivElement> {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	mountedApps.push({ container, root });
	await act(async () => {
		root.render(<App />);
		await tick();
	});
	return container;
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
	const button = [...container.querySelectorAll("button")].find((candidate) =>
		candidate.textContent?.includes(text)
	);
	if (!(button instanceof HTMLButtonElement)) {
		throw new Error(`Could not find button containing: ${text}`);
	}
	return button;
}

async function clickButton(
	container: HTMLElement,
	text: string
): Promise<void> {
	await act(async () => {
		findButton(container, text).click();
		await tick();
	});
}

async function fillMessage(
	container: HTMLElement,
	text: string
): Promise<void> {
	const field = container.querySelector<HTMLTextAreaElement>(
		'textarea[aria-label="Broadcast message"]'
	);
	if (!field) {
		throw new Error("Could not find the broadcast message field.");
	}
	await act(async () => {
		const setter = Object.getOwnPropertyDescriptor(
			Object.getPrototypeOf(field),
			"value"
		)?.set;
		setter?.call(field, text);
		field.dispatchEvent(new Event("input", { bubbles: true }));
		await tick();
	});
}

async function selectChat(
	container: HTMLElement,
	title: string
): Promise<void> {
	const checkbox = container.querySelector<HTMLElement>(
		`[role="checkbox"][aria-label="Select ${title}"]`
	);
	if (!checkbox) {
		throw new Error(`Could not find the selection control for ${title}.`);
	}
	await act(async () => {
		checkbox.focus();
		checkbox.dispatchEvent(
			new KeyboardEvent("keydown", {
				bubbles: true,
				code: "Space",
				key: " ",
			})
		);
		checkbox.dispatchEvent(
			new KeyboardEvent("keyup", {
				bubbles: true,
				code: "Space",
				key: " ",
			})
		);
		await tick();
	});
}

afterEach(async () => {
	for (const { container, root } of mountedApps.splice(0)) {
		await act(async () => root.unmount());
		container.remove();
	}
	Reflect.set(window, "ryu", undefined);
});

describe("Chat Broadcast rendered workflows", () => {
	test("reviews targeted chats before sending and reports each local delivery result", async () => {
		const bridge = installBridge();
		const container = await mountApp();
		expect(container.textContent).toContain("Running review");
		expect(container.textContent).not.toContain("Archived chat");
		expect(container.textContent).toContain("1 running chat is selected");

		await clickButton(container, "Selected · 0");
		await selectChat(container, "Idle planning");
		await selectChat(container, "Idle research");
		await fillMessage(container, "Please summarize your current work.");
		expect(container.textContent).toContain("Ready to send to 2 chats.");
		await clickButton(container, "Send to 2 chats");
		expect(document.body.textContent).toContain("Send to 2 chats?");
		expect(document.body.textContent).toContain(
			"Please summarize your current work."
		);
		expect(bridge.sendCalls).toHaveLength(0);

		await clickButton(document.body, "Back");
		expect(document.body.textContent).not.toContain("Send to 2 chats?");
		expect(bridge.sendCalls).toHaveLength(0);
		await clickButton(container, "Send to 2 chats");
		await clickButton(document.body, "Send now");

		expect(bridge.sendCalls).toEqual([
			{
				conversationId: "idle-1",
				text: "Please summarize your current work.",
			},
			{
				conversationId: "idle-2",
				text: "Please summarize your current work.",
			},
		]);
		expect(container.textContent).toContain("1/2 accepted");
		expect(container.textContent).toContain(
			"This conversation is no longer writable."
		);
		expect(
			container.querySelector<HTMLTextAreaElement>(
				'textarea[aria-label="Broadcast message"]'
			)?.value
		).toBe("Please summarize your current work.");
	});

	test("Dismiss hides the current chat-list error while Refresh retries the local bridge", async () => {
		const bridge = installBridge();
		const container = await mountApp();
		bridge.failNextList();
		await clickButton(container, "Refresh");
		expect(container.textContent).toContain(
			"Chat host is temporarily unavailable."
		);

		await clickButton(container, "Dismiss");
		expect(container.textContent).not.toContain(
			"Chat host is temporarily unavailable."
		);
		expect(bridge.listCalls.length).toBe(2);
	});

	test("confirmation freezes the reviewed recipients and message", async () => {
		const bridge = installBridge();
		const container = await mountApp();
		await clickButton(container, "Selected · 0");
		await selectChat(container, "Idle planning");
		await fillMessage(container, "Reviewed instruction");
		await clickButton(container, "Send to 1 chats");

		// A host refresh or an inaccessible background control must not change the
		// operation after the user has reached the confirmation boundary.
		await selectChat(container, "Idle research");
		await fillMessage(container, "Unreviewed replacement");
		const dialog = document.body.querySelector('[role="dialog"]');
		expect(dialog?.textContent).toContain("Reviewed instruction");
		expect(dialog?.textContent).not.toContain("Unreviewed replacement");
		await clickButton(document.body, "Send now");

		expect(bridge.sendCalls).toEqual([
			{ conversationId: "idle-1", text: "Reviewed instruction" },
		]);
	});

	test("concurrent confirmation clicks dispatch each reviewed target exactly once", async () => {
		const bridge = installBridge();
		const container = await mountApp();
		await fillMessage(container, "One delivery only");
		await clickButton(container, "Send to 1 chats");
		const sendNow = findButton(document.body, "Send now");
		await act(async () => {
			sendNow.click();
			sendNow.click();
			await tick();
			await tick();
		});
		expect(bridge.sendCalls).toEqual([
			{ conversationId: "running-1", text: "One delivery only" },
		]);
	});
});
