/**
 * pdfjs-dist ships types only for its default build; Node needs `legacy/build/pdf.mjs`
 * (the default build relies on `Promise.try`), so map the legacy entry to the published types.
 */
declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export * from 'pdfjs-dist';
}
