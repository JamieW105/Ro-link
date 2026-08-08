import type { ModuleProjectProblem } from '@/lib/moduleIde';

export const MODULE_UI_MAX_NODES = 1000;
export const MODULE_UI_MAX_DEPTH = 32;

export const MODULE_UI_CLASSES = new Set([
    'ScreenGui', 'BillboardGui', 'SurfaceGui', 'Frame', 'ScrollingFrame', 'CanvasGroup',
    'TextLabel', 'TextButton', 'TextBox', 'ImageLabel', 'ImageButton', 'VideoFrame', 'ViewportFrame',
    'UIListLayout', 'UIGridLayout', 'UIPageLayout', 'UITableLayout', 'UIPadding', 'UIStroke',
    'UICorner', 'UIGradient', 'UIAspectRatioConstraint', 'UISizeConstraint', 'UITextSizeConstraint',
    'Folder', 'Configuration', 'StringValue', 'BoolValue', 'IntValue', 'NumberValue',
]);

const ENCODED_VALUE_TYPES = new Set([
    'Color3', 'Vector2', 'Vector3', 'UDim', 'UDim2', 'Rect', 'ColorSequence',
    'NumberSequence', 'EnumItem', 'InstanceRef',
]);

function isSerializableValue(value: unknown, depth = 0): boolean {
    if (value == null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return true;
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 4) return false;
    const encoded = value as Record<string, unknown>;
    return typeof encoded.type === 'string' && ENCODED_VALUE_TYPES.has(encoded.type)
        && Object.values(encoded).every((nested) => isSerializableValue(nested, depth + 1));
}

export function validateModuleUiTree(tree: unknown, file: string): ModuleProjectProblem[] {
    const problems: ModuleProjectProblem[] = [];
    let nodes = 0;
    const visit = (value: unknown, depth: number) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            problems.push({ severity: 'error', file, code: 'invalid_ui_node', message: 'UI hierarchy contains a malformed node.' });
            return;
        }
        nodes += 1;
        if (nodes > MODULE_UI_MAX_NODES) return;
        if (depth > MODULE_UI_MAX_DEPTH) {
            problems.push({ severity: 'error', file, code: 'ui_depth_limit', message: `UI hierarchies are limited to ${MODULE_UI_MAX_DEPTH} levels.` });
            return;
        }
        const node = value as Record<string, unknown>;
        const className = String(node.className || '');
        if (!MODULE_UI_CLASSES.has(className)) problems.push({ severity: 'error', file, code: 'unsupported_ui_class', message: `${className || 'Unknown UI class'} is not supported in module UI bundles.` });
        if (!String(node.name || '').trim() || String(node.name).length > 100) problems.push({ severity: 'error', file, code: 'invalid_ui_name', message: 'Every UI object requires a name up to 100 characters.' });
        for (const [property, propertyValue] of Object.entries((node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)) ? node.properties as Record<string, unknown> : {})) {
            if (!property || property.length > 100 || !isSerializableValue(propertyValue)) problems.push({ severity: 'error', file, code: 'invalid_ui_property', message: `${className}.${property || '(unnamed property)'} cannot be safely serialized.` });
        }
        for (const [attribute, attributeValue] of Object.entries((node.attributes && typeof node.attributes === 'object' && !Array.isArray(node.attributes)) ? node.attributes as Record<string, unknown> : {})) {
            if (!attribute || attribute.length > 100 || !isSerializableValue(attributeValue)) problems.push({ severity: 'error', file, code: 'invalid_ui_attribute', message: `${className} has an unsupported serialized attribute.` });
        }
        const children = node.children == null ? [] : node.children;
        if (!Array.isArray(children)) problems.push({ severity: 'error', file, code: 'invalid_ui_children', message: `${className}.children must be an array.` });
        else for (const child of children) visit(child, depth + 1);
    };
    visit(tree, 0);
    if (nodes > MODULE_UI_MAX_NODES) problems.push({ severity: 'error', file, code: 'ui_node_limit', message: `UI bundles are limited to ${MODULE_UI_MAX_NODES} objects per root.` });
    return problems;
}
