import { Badge } from "@ryu/ui/components/badge.tsx";
import { Button } from "@ryu/ui/components/button.tsx";
import { Input } from "@ryu/ui/components/input.tsx";
import { Spinner } from "@ryu/ui/components/spinner.tsx";
import { Textarea } from "@ryu/ui/components/textarea.tsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listChatConversations, sendChatMessage } from "./bridge.ts";
import type { ChatConversation } from "./ryu.d.ts";
import {
	type BroadcastScope,
	selectBroadcastTargets,
	visibleBroadcastConversations,
} from "./selection.ts";

interface DeliveryResult {
	error?: string;
	id: string;
	status: "accepted" | "failed";
}

function chatTitle(conversation: ChatConversation): string {
	return conversation.title?.trim() || "Untitled chat";
}

function chatAgent(conversation: ChatConversation): string {
	return conversation.agent_id?.trim() || "Default agent";
}

function errorMessage(error: unknown): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return "The host could not deliver this message.";
}

function isRunning(conversation: ChatConversation): boolean {
	return conversation.run_status === "running";
}

export function App() {
	const [conversations, setConversations] = useState<ChatConversation[]>([]);
	const [scope, setScope] = useState<BroadcastScope>("running");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
	const [message, setMessage] = useState("");
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [sending, setSending] = useState(false);
	const [sendingId, setSendingId] = useState<string | null>(null);
	const [results, setResults] = useState<DeliveryResult[]>([]);

	const loadConversations = useCallback(async () => {
		setRefreshing(true);
		setError(null);
		try {
			const next = await listChatConversations();
			setConversations(next);
			setSelectedIds((current) => {
				const visibleIds = new Set(
					visibleBroadcastConversations(next).map(
						(conversation) => conversation.id
					)
				);
				return new Set(
					[...current].filter((conversationId) =>
						visibleIds.has(conversationId)
					)
				);
			});
		} catch (loadError) {
			setError(errorMessage(loadError));
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, []);

	useEffect(() => {
		void loadConversations();
		const refreshTimer = window.setInterval(() => {
			void loadConversations();
		}, 15_000);
		return () => window.clearInterval(refreshTimer);
	}, [loadConversations]);

	const visibleConversations = useMemo(
		() => visibleBroadcastConversations(conversations),
		[conversations]
	);
	const runningCount = useMemo(
		() =>
			visibleConversations.filter((conversation) => isRunning(conversation))
				.length,
		[visibleConversations]
	);
	const targets = useMemo(
		() => selectBroadcastTargets(conversations, scope, selectedIds),
		[conversations, scope, selectedIds]
	);
	const sendingConversation = sendingId
		? (conversations.find((conversation) => conversation.id === sendingId) ??
			targets.find((conversation) => conversation.id === sendingId))
		: undefined;
	const trimmedMessage = message.trim();
	const canSend = targets.length > 0 && trimmedMessage.length > 0 && !sending;

	function toggleSelected(conversationId: string) {
		setSelectedIds((current) => {
			const next = new Set(current);
			if (next.has(conversationId)) {
				next.delete(conversationId);
			} else {
				next.add(conversationId);
			}
			return next;
		});
	}

	function beginSend() {
		if (!canSend) {
			return;
		}
		setError(null);
		setResults([]);
		setConfirming(true);
	}

	async function confirmSend() {
		if (!canSend) {
			return;
		}
		setSending(true);
		setError(null);
		const nextResults: DeliveryResult[] = [];
		for (const target of targets) {
			setSendingId(target.id);
			try {
				await sendChatMessage({
					conversationId: target.id,
					text: trimmedMessage,
				});
				nextResults.push({ id: target.id, status: "accepted" });
			} catch (sendError) {
				nextResults.push({
					error: errorMessage(sendError),
					id: target.id,
					status: "failed",
				});
			}
			setResults([...nextResults]);
		}
		setSendingId(null);
		setSending(false);
		setConfirming(false);
		if (nextResults.every((result) => result.status === "accepted")) {
			setMessage("");
		}
		await loadConversations();
	}

	return (
		<main className="min-h-full bg-background text-foreground">
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
				<header className="flex items-start justify-between gap-5">
					<div className="flex min-w-0 items-start gap-4">
						<div
							aria-hidden="true"
							className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/12 font-medium text-2xl text-primary"
						>
							↗
						</div>
						<div className="min-w-0">
							<p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
								Coordination tool
							</p>
							<h1 className="font-medium text-3xl tracking-tight">
								Chat Broadcast
							</h1>
							<p className="mt-2 max-w-xl text-muted-foreground leading-6">
								Change direction across many chats at once.
							</p>
						</div>
					</div>
					<Button
						aria-label="Refresh chats"
						disabled={refreshing || sending}
						onClick={() => void loadConversations()}
						size="sm"
						variant="ghost-muted"
					>
						{refreshing ? <Spinner size="sm" /> : "Refresh"}
					</Button>
				</header>

				<div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/6 px-4 py-3.5 text-sm leading-5">
					<span aria-hidden="true" className="mt-0.5 text-primary">
						✦
					</span>
					<p>
						Send one instruction to every running chat, or pick specific chats —
						including idle conversations.
					</p>
				</div>

				{error ? (
					<div className="flex items-start justify-between gap-3 rounded-2xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-destructive text-sm">
						<p>{error}</p>
						<Button
							className="shrink-0 underline underline-offset-4"
							onClick={() => setError(null)}
							type="button"
						>
							Dismiss
						</Button>
					</div>
				) : null}

				<section className="overflow-hidden rounded-3xl border bg-card shadow-[0_12px_40px_-28px_color-mix(in_oklch,var(--foreground),transparent_35%)]">
					<div className="border-b px-5 py-5 sm:px-6">
						<div className="flex flex-wrap items-start justify-between gap-4">
							<div>
								<h2 className="font-medium text-lg">Choose chats</h2>
								<p className="mt-1 text-muted-foreground text-sm">
									{scope === "running"
										? runningCount > 0
											? `${runningCount} running ${runningCount === 1 ? "chat is" : "chats are"} selected.`
											: "No chats are running right now."
										: `${selectedIds.size} ${selectedIds.size === 1 ? "chat" : "chats"} selected, including idle chats.`}
								</p>
							</div>
							<div
								aria-label="Broadcast scope"
								className="flex rounded-xl border bg-muted/50 p-1"
								role="tablist"
							>
								{(
									[
										["running", `Running · ${runningCount}`],
										["selected", `Selected · ${selectedIds.size}`],
									] as const
								).map(([value, label]) => (
									<Button
										aria-selected={scope === value}
										className={`rounded-lg px-3 py-1.5 font-medium text-xs transition-colors ${scope === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
										onClick={() => setScope(value)}
										role="tab"
										type="button"
									>
										{label}
									</Button>
								))}
							</div>
						</div>
					</div>

					<div className="divide-y">
						{loading ? (
							<div className="flex items-center justify-center gap-2 px-5 py-12 text-muted-foreground text-sm">
								<Spinner />
								Loading visible chats…
							</div>
						) : visibleConversations.length === 0 ? (
							<div className="px-5 py-12 text-center sm:px-6">
								<p className="font-medium">No visible chats yet</p>
								<p className="mt-1 text-muted-foreground text-sm">
									Start a chat, then come back here to coordinate it with the
									rest.
								</p>
							</div>
						) : (
							visibleConversations.map((conversation) => {
								const running = isRunning(conversation);
								const checked =
									scope === "running"
										? running
										: selectedIds.has(conversation.id);
								return (
									<label
										className={`flex cursor-pointer items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/35 sm:px-6 ${!running && scope === "running" ? "cursor-default opacity-55" : ""}`}
										key={conversation.id}
									>
										<Input
											aria-label={`Select ${chatTitle(conversation)}`}
											checked={checked}
											className="size-4 shrink-0 accent-primary"
											disabled={scope === "running"}
											onChange={() => toggleSelected(conversation.id)}
											type="checkbox"
										/>
										<span className="min-w-0 flex-1">
											<span className="flex min-w-0 items-center gap-2">
												<span className="truncate font-medium text-sm">
													{chatTitle(conversation)}
												</span>
												<Badge variant={running ? "default" : "secondary"}>
													{running ? "Running" : "Idle"}
												</Badge>
											</span>
											<span className="mt-1 block truncate text-muted-foreground text-xs">
												{chatAgent(conversation)} · {conversation.message_count}{" "}
												messages
											</span>
										</span>
									</label>
								);
							})
						)}
					</div>
				</section>

				<section className="rounded-3xl border bg-card p-5 shadow-[0_12px_40px_-28px_color-mix(in_oklch,var(--foreground),transparent_35%)] sm:p-6">
					<div className="flex items-center justify-between gap-3">
						<div>
							<h2 className="font-medium text-lg">Message</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								Write the instruction exactly as it should appear in each chat.
							</p>
						</div>
						<span className="text-muted-foreground text-xs">
							{message.length}/8000
						</span>
					</div>
					<Textarea
						aria-label="Broadcast message"
						className="mt-4 min-h-32 w-full resize-y rounded-2xl border bg-background px-4 py-3 text-sm leading-6 outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-ring focus:ring-3 focus:ring-ring/20"
						maxLength={8000}
						onChange={(event) => setMessage(event.target.value)}
						placeholder="Stop linting — it’s taking too long. Keep the current plan, but skip lint for this task."
						value={message}
					/>
					<div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/55 px-3.5 py-3 text-muted-foreground text-xs leading-5">
						<span aria-hidden="true" className="text-primary">
							i
						</span>
						<p>
							This becomes a real user turn in each selected chat. Running chats
							queue it behind the current turn; idle chats start it normally.
						</p>
					</div>
				</section>

				<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
					<p className="text-muted-foreground text-sm">
						{targets.length > 0
							? `Ready to send to ${targets.length} ${targets.length === 1 ? "chat" : "chats"}.`
							: "Choose at least one chat to continue."}
					</p>
					<Button disabled={!canSend} onClick={beginSend} size="lg">
						{targets.length > 0
							? `Send to ${targets.length} chats`
							: "Send broadcast"}
					</Button>
				</div>

				{results.length > 0 ? (
					<section className="rounded-2xl border bg-card p-4">
						<div className="flex items-center justify-between gap-3">
							<h2 className="font-medium text-sm">Latest delivery</h2>
							<span className="text-muted-foreground text-xs">
								{
									results.filter((result) => result.status === "accepted")
										.length
								}
								/{results.length} accepted
							</span>
						</div>
						<div className="mt-3 space-y-2">
							{results.map((result) => {
								const conversation = conversations.find(
									(item) => item.id === result.id
								);
								return (
									<div
										className="flex items-start gap-2 text-sm"
										key={result.id}
									>
										<span
											className={
												result.status === "accepted"
													? "text-success"
													: "text-destructive"
											}
										>
											{result.status === "accepted" ? "✓" : "!"}
										</span>
										<span className="min-w-0 flex-1 truncate">
											{conversation ? chatTitle(conversation) : result.id}
										</span>
										{result.error ? (
											<span className="max-w-[55%] truncate text-destructive text-xs">
												{result.error}
											</span>
										) : null}
									</div>
								);
							})}
						</div>
					</section>
				) : null}
			</div>

			{confirming ? (
				<div
					aria-labelledby="broadcast-confirm-title"
					aria-modal="true"
					className="fixed inset-0 z-10 grid place-items-center bg-foreground/35 p-5 backdrop-blur-[2px]"
					role="dialog"
				>
					<div className="w-full max-w-lg rounded-3xl border bg-card p-6 text-card-foreground shadow-2xl">
						<p className="font-medium text-primary text-xs uppercase tracking-[0.16em]">
							Final check
						</p>
						<h2
							className="mt-2 font-medium text-2xl tracking-tight"
							id="broadcast-confirm-title"
						>
							Send to {targets.length} {targets.length === 1 ? "chat" : "chats"}
							?
						</h2>
						<p className="mt-2 text-muted-foreground text-sm leading-5">
							This will add the following message as a real user turn in every
							selected chat.
						</p>
						<div className="mt-4 rounded-2xl border bg-muted/45 px-4 py-3 text-sm leading-6">
							{trimmedMessage}
						</div>
						<div className="mt-4 flex flex-wrap gap-2">
							{targets.slice(0, 5).map((target) => (
								<Badge key={target.id} variant="secondary">
									{chatTitle(target)}
								</Badge>
							))}
							{targets.length > 5 ? (
								<Badge variant="outline">+{targets.length - 5} more</Badge>
							) : null}
						</div>
						<p className="mt-4 text-muted-foreground text-xs leading-5">
							{sendingId
								? `Sending to ${sendingConversation ? chatTitle(sendingConversation) : "selected chat"}…`
								: "Running chats will continue with this instruction after their current turn."}
						</p>
						<div className="mt-6 flex justify-end gap-2">
							<Button
								disabled={sending}
								onClick={() => setConfirming(false)}
								variant="outline"
							>
								Back
							</Button>
							<Button loading={sending} onClick={() => void confirmSend()}>
								Send now
							</Button>
						</div>
					</div>
				</div>
			) : null}
		</main>
	);
}
