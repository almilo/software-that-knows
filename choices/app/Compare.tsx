import type { Decision, Outcome } from "../decide/decision";

// The diagram as a table, from the ontology: the options on its dimensions, with the option
// recommended marked, and the options recommended for parts.
export function Compare({ d, outcome }: { d: Decision; outcome?: Outcome }) {
  const { chosen, additions } = outcome ? d.optionsOf(outcome) : { chosen: undefined, additions: [] as string[] };
  const role = (id: string) => (id === chosen ? "recommended" : additions.includes(id) ? "for parts" : undefined);
  const className = (id: string) => role(id)?.replace(" ", "-");
  const dimensions = d.options[0]!.dimensions.map((dim) => dim.label);
  const hasTools = d.options.some((o) => o.tools.length);
  return (
    <section className="compare">
      <h2>{d.domain.optionsTitle}</h2>
      <div className="table">
        <table>
          <thead>
            <tr>
              <th />
              {d.options.map((o) => (
                <th key={o.id} className={className(o.id)}>
                  {o.label}
                  {role(o.id) && <small> {role(o.id)}</small>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dimensions.map((label, i) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {d.options.map((o) => (
                  <td key={o.id} className={className(o.id)}>
                    {o.dimensions[i]!.characteristics.join("; ")}
                  </td>
                ))}
              </tr>
            ))}
            {hasTools && (
              <tr>
                <th scope="row">Tools</th>
                {d.options.map((o) => (
                  <td key={o.id} className={className(o.id)}>
                    {o.tools.map((t) => t.label).join(", ")}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
