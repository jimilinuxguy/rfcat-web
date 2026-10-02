import {
    WORKSPACE_SCHEMA_VERSION,
    loadWorkspaceLayout,
    resetWorkspaceLayout,
    saveWorkspaceLayout,
} from "../storage/workspace-store.js";

const PANEL_DEFINITIONS = [
    ["radio", ".radio"],
    ["receiver", ".receiver-card"],
    ["pulse-analyzer", ".pulse-analyzer-card"],
    ["transmitter", ".transmitter-card"],
    ["waveform", ".waveform-card"],
    ["activity", ".console"],
];

function panelId(panel) {
    return panel.dataset.workspacePanel;
}

function captureLayout(workspace) {
    return {
        version: WORKSPACE_SCHEMA_VERSION,
        panels: [...workspace.children]
            .filter((panel) => panel.matches("[data-workspace-panel]"))
            .map((panel, order) => ({
                id: panelId(panel),
                order,
                width: Math.round(panel.getBoundingClientRect().width),
                height: panel.tagName === "DETAILS" && !panel.open
                    ? 58
                    : Math.round(panel.getBoundingClientRect().height),
                open: panel.tagName === "DETAILS" ? panel.open : null,
            })),
    };
}

function applyLayout(workspace, layout) {
    if (!layout) return;
    const states = new Map(layout.panels.map((panel) => [panel.id, panel]));
    const ordered = [...workspace.children]
        .filter((panel) => panel.matches("[data-workspace-panel]"))
        .sort((a, b) => (states.get(panelId(a))?.order ?? 999) - (states.get(panelId(b))?.order ?? 999));

    for (const panel of ordered) {
        const state = states.get(panelId(panel));
        workspace.append(panel);
        if (!state) continue;
        if (state.width) panel.style.width = `${state.width}px`;
        if (state.height && state.open !== false) panel.style.height = `${state.height}px`;
        if (panel.tagName === "DETAILS" && state.open !== null) panel.open = state.open;
    }
}

function makeToolbar(onReset) {
    const toolbar = document.createElement("div");
    toolbar.className = "workspace-toolbar";
    const copy = document.createElement("div");
    copy.innerHTML = "<strong>Workspace</strong><span>Drag panels by the grip. Resize from the lower-right corner.</span>";
    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "Reset layout";
    reset.onclick = onReset;
    toolbar.append(copy, reset);
    return toolbar;
}

export async function initWorkspace() {
    const main = document.querySelector("main");
    if (!main || main.dataset.workspaceReady) return;
    main.dataset.workspaceReady = "true";

    const workspace = document.createElement("div");
    workspace.className = "workspace";
    const sourceOrder = [];
    for (const [id, selector] of PANEL_DEFINITIONS) {
        const panel = main.querySelector(selector);
        if (!panel) continue;
        panel.dataset.workspacePanel = id;
        panel.classList.add("workspace-panel");
        panel.style.order = "";
        sourceOrder.push(panel);

        const grip = document.createElement("button");
        grip.type = "button";
        grip.className = "workspace-grip";
        grip.draggable = true;
        grip.title = "Drag to move panel";
        grip.setAttribute("aria-label", `Move ${id} panel`);
        grip.textContent = "⠿";
        panel.append(grip);
    }

    const anchor = main.firstElementChild;
    main.insertBefore(workspace, anchor);
    sourceOrder.forEach((panel) => workspace.append(panel));

    let saveTimer = null;
    let restoring = true;
    const scheduleSave = () => {
        if (restoring) return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveWorkspaceLayout(captureLayout(workspace)).catch(() => {});
        }, 200);
    };

    const toolbar = makeToolbar(async () => {
        await resetWorkspaceLayout().catch(() => {});
        for (const panel of sourceOrder) {
            panel.style.width = "";
            panel.style.height = "";
            workspace.append(panel);
        }
        document.querySelector(".radio")?.setAttribute("open", "");
        document.querySelector(".console")?.setAttribute("open", "");
        document.querySelector(".pulse-analyzer-card")?.removeAttribute("open");
        document.querySelector(".transmitter-card")?.removeAttribute("open");
        document.querySelector(".waveform-card")?.removeAttribute("open");
        scheduleSave();
    });
    main.insertBefore(toolbar, workspace);

    let dragged = null;
    workspace.addEventListener("dragstart", (event) => {
        if (!event.target.classList?.contains("workspace-grip")) return;
        dragged = event.target.closest("[data-workspace-panel]");
        dragged?.classList.add("workspace-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", panelId(dragged));
    });
    workspace.addEventListener("dragover", (event) => {
        if (!dragged) return;
        event.preventDefault();
        const target = event.target.closest("[data-workspace-panel]");
        if (!target || target === dragged) return;
        const box = target.getBoundingClientRect();
        const before = event.clientY < box.top + box.height / 2 ||
            (Math.abs(event.clientY - (box.top + box.height / 2)) < box.height / 4 &&
             event.clientX < box.left + box.width / 2);
        workspace.insertBefore(dragged, before ? target : target.nextSibling);
    });
    workspace.addEventListener("dragend", () => {
        dragged?.classList.remove("workspace-dragging");
        dragged = null;
        scheduleSave();
    });
    workspace.addEventListener("toggle", scheduleSave, true);

    if (globalThis.ResizeObserver) {
        const observer = new ResizeObserver((entries) => {
            if (entries.some((entry) => entry.target.matches("[data-workspace-panel]"))) scheduleSave();
        });
        sourceOrder.forEach((panel) => observer.observe(panel));
    }

    const layout = await loadWorkspaceLayout().catch(() => null);
    applyLayout(workspace, layout);
    restoring = false;
}
