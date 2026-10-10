import { type Outcome, styles, stylesOf } from "../decide/decide";

// The diagram as a table, from the ontology: the three styles on its dimensions, with the style
// recommended for the system marked, and the style recommended for parts of it.
export function Compare({ outcome }: { outcome?: Outcome }) {
  const { system, parts } = outcome ? stylesOf(outcome) : { system: undefined, parts: [] as string[] };
  const role = (id: string) => (id === system ? "recommended" : parts.includes(id) ? "for parts" : undefined);
  const className = (id: string) => role(id)?.replace(" ", "-");
  const dimensions = styles[0]!.dimensions.map((d) => d.label);
  return (
    <section className="compare">
      <h2>The three styles, from the diagram</h2>
      <div className="table">
        <table>
          <thead>
            <tr>
              <th />
              {styles.map((s) => (
                <th key={s.id} className={className(s.id)}>
                  {s.label}
                  {role(s.id) && <small> {role(s.id)}</small>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dimensions.map((label, i) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {styles.map((s) => (
                  <td key={s.id} className={className(s.id)}>
                    {s.dimensions[i]!.characteristics.join("; ")}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">Tools</th>
              {styles.map((s) => (
                <td key={s.id} className={className(s.id)}>
                  {s.tools.map((t) => t.label).join(", ")}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
