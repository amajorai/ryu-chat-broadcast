<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./icon-dark.png" />
    <img src="./icon-light.png" alt="Chat Broadcast" width="144" />
  </picture>
</p>

<div align="center">

# Chat Broadcast

</div>

Send one confirmed instruction to every running chat or a hand-picked set of visible chats, including idle conversations.

> **The public home of `ryu-chat-broadcast`.** Source, builds, and releases live here —
> binaries for every platform are attached to each release.
>
> This tree is generated from the Ryu monorepo, so commits pushed here
> directly are replaced on the next sync. **Pull requests are welcome** —
> open them here and they are ported into the monorepo, then flow back out.
> Ryu as a whole: https://github.com/amajorai/ryu

## Install

**App:** [Install](ryu://apps/@ryu/chat-broadcast) (opens the Ryu desktop app and asks you to confirm)

**CLI:**

```bash
ryu apps add @ryu/chat-broadcast
```

## Source & build

This is the **source of record** for the app UI. It imports Ryu's private
`@ryu/ui` design system, so it does **not** build standalone outside the
monorepo — it **builds inside the amajorai/ryu monorepo workspace**.
The shipped bundle is the built artifact, produced by the monorepo build.

## License

Apache-2.0 — see [LICENSE](./LICENSE).

## Parts

- **`ui/` — companion (companion-only app, no backend crate).** The full-page
  companion lists the chats visible to the current user, defaults to all running
  chats, and lets the user switch to a hand-picked set that can include idle
  chats.
- **Host bridge.** The trusted desktop host performs the conversation ACL checks
  and posts a normal user turn to each selected chat. The sandbox receives only
  redacted conversation summaries; it never receives a node token or transcript.

There is no dedicated backend crate or sidecar. Core remains responsible for
conversation identity, access control, persistence, and queueing.

## Sending

The app requires the explicit `chat.sendFollowUp` permission. It shows archived
chats nowhere, selects every currently running chat by default, and asks for a
confirmation before sending. Messages are delivered sequentially so a large
broadcast does not create a burst of concurrent requests. A running chat queues
the broadcast behind its current turn; an idle chat starts the turn normally.

Each delivery is a real user message in the destination chat, not hidden control
metadata. That makes the instruction visible in the transcript and gives the
agent the same context as a message typed in that chat.
