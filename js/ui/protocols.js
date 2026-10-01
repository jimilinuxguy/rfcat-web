export function renderProtocolSelector(select, protocols) {
    select.replaceChildren();

    for (const protocol of protocols) {
        const option = document.createElement("option");

        option.value = protocol.id;
        option.textContent = protocol.name;

        select.appendChild(option);
    }
}

export function renderProtocolFields(container, protocol) {
    container.replaceChildren();

    if (protocol.description) {
        const description = document.createElement("p");

        description.className = "hint";
        description.textContent = protocol.description;

        container.appendChild(description);
    }

    for (const field of protocol.fields ?? []) {
        const label = document.createElement("label");

        label.textContent = field.label;
        label.dataset.protocolFieldWrapper = field.id;

        if (field.visibleWhen) {
            label.dataset.visibleWhenField = field.visibleWhen.field;
            label.dataset.visibleWhenValues = field.visibleWhen.values.join(",");
        }

        let input;

        switch (field.type) {
            case "select": {
                input = document.createElement("select");

                for (const option of field.options ?? []) {
                    const element = document.createElement("option");

                    element.value = option.value;
                    element.textContent = option.label;

                    input.appendChild(element);
                }

                break;
            }

            case "textarea": {
                input = document.createElement("textarea");

                if (field.rows !== undefined) {
                    input.rows = field.rows;
                }

                break;
            }

            case "checkbox": {
                input = document.createElement("input");
                input.type = "checkbox";
                break;
            }

            default: {
                input = document.createElement("input");
                input.type = field.type ?? "text";
                break;
            }
        }

        input.id = `protocol-${protocol.id}-${field.id}`;
        input.dataset.protocolField = field.id;

        if (field.placeholder !== undefined) {
            input.placeholder = field.placeholder;
        }

        if (field.min !== undefined) {
            input.min = String(field.min);
        }

        if (field.max !== undefined) {
            input.max = String(field.max);
        }

        if (field.step !== undefined) {
            input.step = String(field.step);
        }

        if (field.type === "checkbox") {
            input.checked = Boolean(field.value);
        } else if (field.value !== undefined) {
            input.value = String(field.value);
        }

        label.appendChild(input);
        container.appendChild(label);
    }

    const updateVisibility = () => {
        for (const label of container.querySelectorAll("[data-visible-when-field]")) {
            const controller = container.querySelector(
                `[data-protocol-field="${label.dataset.visibleWhenField}"]`,
            );
            const allowed = (label.dataset.visibleWhenValues ?? "").split(",");
            const visible = controller && allowed.includes(String(controller.value));
            label.hidden = !visible;
            label.style.display = visible ? "" : "none";
        }
    };

    for (const input of container.querySelectorAll("[data-protocol-field]")) {
        input.addEventListener("change", updateVisibility);
    }

    updateVisibility();
}

export function getProtocolValues(container, protocol) {
    const values = {};

    for (const field of protocol.fields ?? []) {
        const input = container.querySelector(
            `[data-protocol-field="${field.id}"]`,
        );

        if (!input) {
            continue;
        }

        switch (field.type) {
            case "number":
                values[field.id] = Number(input.value);
                break;

            case "checkbox":
                values[field.id] = input.checked;
                break;

            default:
                values[field.id] = input.value;
                break;
        }
    }

    return values;
}