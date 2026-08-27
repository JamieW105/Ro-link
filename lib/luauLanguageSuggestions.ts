export type LuauLanguageSuggestion = {
    label: string;
    insertText: string;
    detail: string;
    kind: 'keyword' | 'snippet' | 'value';
};

export const luauLanguageSuggestions: LuauLanguageSuggestion[] = [
    { label: 'local', insertText: 'local ${1:name} = ${2:value}', detail: 'Declare a local variable', kind: 'snippet' },
    { label: 'local function', insertText: 'local function ${1:name}(${2})\n\t${0}\nend', detail: 'Declare a local function', kind: 'snippet' },
    { label: 'function', insertText: 'function ${1:name}(${2})\n\t${0}\nend', detail: 'Declare a function', kind: 'snippet' },
    { label: 'if', insertText: 'if ${1:condition} then\n\t${0}\nend', detail: 'If statement', kind: 'snippet' },
    { label: 'if … else', insertText: 'if ${1:condition} then\n\t${2}\nelse\n\t${0}\nend', detail: 'If/else statement', kind: 'snippet' },
    { label: 'for … in', insertText: 'for ${1:key}, ${2:value} in ${3:table} do\n\t${0}\nend', detail: 'Generalized Luau iteration', kind: 'snippet' },
    { label: 'for … in pairs', insertText: 'for ${1:key}, ${2:value} in pairs(${3:table}) do\n\t${0}\nend', detail: 'Iterate over table keys and values', kind: 'snippet' },
    { label: 'for … in ipairs', insertText: 'for ${1:index}, ${2:value} in ipairs(${3:array}) do\n\t${0}\nend', detail: 'Iterate over an array in order', kind: 'snippet' },
    { label: 'for i = …', insertText: 'for ${1:i} = ${2:1}, ${3:10}${4:, 1} do\n\t${0}\nend', detail: 'Numeric for loop', kind: 'snippet' },
    { label: 'while', insertText: 'while ${1:condition} do\n\t${0}\nend', detail: 'While loop', kind: 'snippet' },
    { label: 'repeat … until', insertText: 'repeat\n\t${0}\nuntil ${1:condition}', detail: 'Repeat loop', kind: 'snippet' },
    { label: 'do … end', insertText: 'do\n\t${0}\nend', detail: 'Scoped block', kind: 'snippet' },
    { label: 'type', insertText: 'type ${1:Name} = ${2:any}', detail: 'Declare a type alias', kind: 'snippet' },
    { label: 'export type', insertText: 'export type ${1:Name} = ${2:any}', detail: 'Declare an exported type alias', kind: 'snippet' },
    { label: 'const', insertText: 'const ${1:name} = ${2:value}', detail: 'Declare an immutable local binding', kind: 'snippet' },
    ...['and', 'break', 'continue', 'do', 'else', 'elseif', 'end', 'export', 'for', 'in', 'not', 'or', 'repeat', 'return', 'then', 'until', 'while'].map((keyword) => ({ label: keyword, insertText: keyword, detail: 'Luau keyword', kind: 'keyword' as const })),
    ...['any', 'boolean', 'buffer', 'never', 'number', 'string', 'thread', 'unknown'].map((typeName) => ({ label: typeName, insertText: typeName, detail: 'Built-in Luau type', kind: 'keyword' as const })),
    ...['true', 'false', 'nil'].map((value) => ({ label: value, insertText: value, detail: `Luau ${value} value`, kind: 'value' as const })),
    { label: 'self', insertText: 'self', detail: 'Current table or object', kind: 'value' },
];
