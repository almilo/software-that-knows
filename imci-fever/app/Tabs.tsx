import { isVisible, rankWith, uiTypeIs, type Categorization, type Category, type LayoutProps } from "@jsonforms/core";
import { JsonFormsDispatch, useJsonForms, withJsonFormsLayoutProps } from "@jsonforms/react";
import { useState } from "react";
import { visibleOnly, type Assessment } from "./classify";

// The tabs of the form, in place of the vanilla Categorization renderer. Each tab shows how many of
// its shown fields have an answer, so answers in another tab are visible, for example after a note
// filled the form. The selected tab is kept by its label, so it stays when the answers change.
function Tabs({ uischema, schema, path, data, visible }: LayoutProps) {
  const { core, config } = useJsonForms();
  const [selected, setSelected] = useState<string>();
  const tabs = (uischema as Categorization).elements.filter(
    (c): c is Category => c.type === "Category" && isVisible(c, data, path, core!.ajv!, config),
  );
  const active = tabs.find((t) => t.label === selected) ?? tabs[0];
  const shown = visibleOnly(data as Assessment);
  const answered = (tab: Category) =>
    tab.elements.filter((c) => "scope" in c && shown[String(c.scope).replace("#/properties/", "")] !== undefined).length;

  return (
    <div className="tabs" hidden={!visible}>
      <div role="tablist">
        {tabs.map((tab) => {
          const count = answered(tab);
          return (
            <button key={tab.label} role="tab" aria-selected={tab === active} onClick={() => setSelected(tab.label)}>
              {tab.label}
              {count > 0 && (
                <span className="badge" aria-label={`${count} answered`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {active?.elements.map((child, i) => (
        <JsonFormsDispatch key={`${active.label}-${i}`} uischema={child} schema={schema} path={path} />
      ))}
    </div>
  );
}

export const tabsRenderer = { tester: rankWith(2, uiTypeIs("Categorization")), renderer: withJsonFormsLayoutProps(Tabs) };
