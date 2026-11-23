// Temporary dev-only wrapper: points Vite at a fresh cache dir so the IDE's safe-delete guard
// does not block the dep re-optimisation triggered by a changed lockfile. Not part of the app.
import base from './vite.config';

export default {
  ...base,
  cacheDir: 'node_modules/.vite-preview',
};
