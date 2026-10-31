/**
 * `a:custGeom` writing/reading now lives in the shared kernel (`core/drawing/drawingml.ts`,
 * P3-1.0) so the docx `wps:wsp` and xlsx `xdr:sp` shape layers reuse it. This module stays as
 * the slide editor's single import site — no logic here.
 */

export { custGeomXml, geometryFromCustGeom, parseCustGeom } from '../../../core/drawing/drawingml';
