/**
 * Compatibility layer: the dropdown button now lives in the shared `@/core/components/MenuButton`
 * (the slide toolbar shares positioning and closing behavior with the word / sheet / slide import-export entry points).
 *
 * This file and its export names are kept so existing `./MenuButton` imports inside the tool need no changes.
 */
export { MenuButton, type MenuItem, type MenuButtonProps } from '@/core/components/MenuButton';
