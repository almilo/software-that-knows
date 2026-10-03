// Bun imports these files with an import attribute: a Turtle file as text, a WebAssembly file as
// its URL in the build (or its path in Bun).
declare module "*.ttl" {
  const text: string;
  export default text;
}
declare module "oxigraph/web_bg.wasm" {
  const url: string;
  export default url;
}
