import {
	markCompanionAppRoot,
	subscribeCompanionTheme,
} from "@ryu/app-host/companion-theme";
import { RyuAppShell } from "@ryu/blocks/companion/app-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./tailwind.css";
import { App } from "./App.tsx";

subscribeCompanionTheme();
const container = document.getElementById("ryu-plugin-root");
if (container) {
	markCompanionAppRoot(container);
	createRoot(container).render(
		<StrictMode>
			<RyuAppShell>
				<App />
			</RyuAppShell>
		</StrictMode>
	);
}
