/**
 * Shared drawing kernel (P2-6).
 *
 * Consumers: the slide editor today; rich-text box shapes and the spreadsheet shape layer later.
 * Contract: pure functions and value types only — no `tools/**` imports, no Konva/DOM/Canvas.
 * OOXML writing stays with each editor (the kernel only produces geometry), see `pptx/write.ts`.
 */

export * from './geometry';
export * from './shapeDefs';
export * from './custGeom';
export * from './boolean';
