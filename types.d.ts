declare module "*.ttl" {
  const text: string;
  export default text;
}
declare module "*.jsonld" {
  const value: unknown;
  export default value;
}
declare module "shacl-engine";
declare module "shacl-engine/sparql.js";
declare module "rdf-ext";
